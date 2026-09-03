/**
 * Zod schemas for every request the API accepts.
 *
 * Keeping all schemas in one file makes the API contract reviewable at a
 * glance and guarantees handlers never receive unvalidated input.
 *
 * Phone numbers are validated AND normalized here with libphonenumber-js:
 * the digit count must match the selected country's rules. Phone is NOT
 * OTP-verified — email is the only verification channel.
 */
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Fallback country for numbers typed WITHOUT an international prefix. */
const DEFAULT_PHONE_COUNTRY = "IN";

/* ------------------------------------------------------------------ */
/* Field builders                                                      */
/* ------------------------------------------------------------------ */

const nameField = z
  .string({ required_error: "Name is required" })
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(50, "Name must be at most 50 characters")
  // Letters (any language) and spaces only — mirrors the User model rule.
  .regex(/^[\p{L}\s]+$/u, "Name may contain letters and spaces only");

const emailField = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Please provide a valid email address")
  .max(254, "Email is too long");

/**
 * Password policy: min 8 chars with uppercase, lowercase, number and
 * special character. Each rule gets its own message for good UX.
 */
export const passwordField = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters") // bcrypt input limit
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/\d/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

/**
 * Raw phone text: libphonenumber validity check (digit count per country),
 * then transformed into strict E.164 + ISO country code.
 */
const phoneRawField = z
  .string({ required_error: "Phone number is required" })
  .trim()
  .min(6, "Phone number is too short")
  .max(20, "Phone number is too long")
  .superRefine((value, ctx) => {
    const parsed = parsePhoneNumberFromString(value, DEFAULT_PHONE_COUNTRY);
    if (!parsed || !parsed.isValid()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a valid phone number for the selected country",
      });
    }
  });

/** Optional reCAPTCHA token (enforced server-side only when keys are set).
 * v3 tokens can exceed 2KB, and validity is checked against Google's
 * siteverify endpoint anyway, so a generous cap is safe here. */
const captchaField = z.string().trim().max(8192).optional();

/** The classic 6-digit OTP code. */
const otpField = z
  .string({ required_error: "Verification code is required" })
  .regex(/^\d{6}$/, "Verification code must be exactly 6 digits");

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

/**
 * Register body (STEP 1 of the signup wizard). Output is normalized:
 *   { name, email, phone: "+9198...", countryCode: "IN", captchaToken? }
 * (confirmPassword / terms are frontend-only concerns and are stripped.)
 *
 * No password here — the account is created unverified, the email is
 * verified via OTP, and the password is chosen afterwards on the same page
 * (POST /set-password). This way no password exists until the email is
 * proven real.
 */
export const registerSchema = z
  .object({
    name: nameField,
    email: emailField,
    phone: phoneRawField,
    captchaToken: captchaField,
  })
  .transform((val) => {
    const parsed = parsePhoneNumberFromString(val.phone, DEFAULT_PHONE_COUNTRY);
    return {
      ...val,
      phone: parsed.number,            // E.164, e.g. "+919876543210"
      countryCode: parsed.country ?? "",
    };
  });

/**
 * POST /set-password — final step of signup. The signupToken (issued by
 * /verify-otp once the email checks out) proves this device just verified
 * the address; the password must satisfy the full complexity policy.
 */
export const setPasswordSchema = z.object({
  signupToken: z
    .string({ required_error: "Verification is required" })
    .min(10, "Verification expired — please register again"),
  password: passwordField,
});

/**
 * Login identifier: an email address OR a phone number in any format.
 * Transformed into { email?, phone? } so the controller can query $or.
 */
const identifierSchema = z
  .string({ required_error: "Email or phone is required" })
  .trim()
  .min(1, "Email or phone is required")
  .max(254, "Identifier is too long")
  .transform((value) => {
    // Email-shaped input passes through; anything else is parsed as a phone.
    if (value.includes("@")) return { email: value.toLowerCase() };
    const parsed = parsePhoneNumberFromString(value, DEFAULT_PHONE_COUNTRY);
    if (!parsed || !parsed.isValid()) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "Enter a valid email address or phone number",
        },
      ]);
    }
    return { phone: parsed.number };
  });

export const loginSchema = z.object({
  /** Accepts email OR phone despite the legacy field name. */
  email: identifierSchema,
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
  captchaToken: captchaField,
  /**
   * UNIFIED verification field (see spec §3): one input that serves two
   * purposes, disambiguated by FORMAT:
   *   - admin code : "ADM-XXXX-XXXX" → admin login (hash-matched first)
   *   - captcha    : the 5-char visual code → normal user login
   * The backend tries the admin code FIRST, then falls back to the visual
   * captcha, so there is never any ambiguity.
   */
  verificationField: z
    .string({ required_error: "Captcha code is required" })
    .trim()
    .min(1, "Enter the captcha code to continue")
    .max(32, "That code is too long"),
  /**
   * Token of the self-hosted VISUAL captcha (GET /api/auth/captcha). Sent
   * whenever the user meant to log in as a normal user (captcha mode);
   * ignored when verificationField resolves to that user's admin code.
   */
  visualCaptchaToken: z.string().trim().min(10, "Captcha is invalid — refresh it").optional(),
});

/** POST /verify-login-otp — completes a 2FA login after the password step. */
export const verifyLoginOtpSchema = z.object({
  pendingToken: z
    .string({ required_error: "Login session token is required" })
    .min(10, "Login session token is invalid"),
  otp: otpField,
  rememberMe: z.boolean().optional().default(false),
});

/** POST /verify-otp — { email, otp } activates the account. */
export const verifyOtpSchema = z.object({
  email: emailField,
  otp: otpField,
});

/** POST /resend-otp — { email }. */
export const resendOtpSchema = z.object({
  email: emailField,
});

/** POST /forgot-password — always answers generically (no user enumeration). */
export const forgotPasswordSchema = z.object({
  email: emailField,
});

/**
 * POST /reset-password — consumes the emailed code and sets a new password
 * (same complexity policy as registration).
 */
export const resetPasswordSchema = z.object({
  email: emailField,
  otp: otpField,
  newPassword: passwordField,
});

/** PATCH /2fa — flip the per-user second factor on/off. */
export const twoFactorSchema = z.object({
  enabled: z.boolean({ required_error: "enabled must be true or false" }),
});

/* ------------------------------------------------------------------ */
/* Todos                                                               */
/* ------------------------------------------------------------------ */

export const createTodoSchema = z.object({
  task: z
    .string({ required_error: "Task text is required" })
    .trim()
    .min(1, "Task cannot be empty")
    .max(200, "Task must be at most 200 characters"),
  description: z.string().trim().max(2000, "Description is too long").optional().default(""),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
  dueDate: z
    .union([z.date(), z.string()])
    .optional()
    .transform((v) => {
      if (!v || v === "" || v === "null") return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }),
  tags: z
    .array(z.string().trim().min(1, "Tag cannot be empty").max(30, "Tag is too long"))
    .max(10, "At most 10 tags")
    .optional()
    .default([]),
  isPinned: z.coerce.boolean().optional().default(false),
  backgroundColor: z.string().max(100).optional().default(""),
  reminderAt: z
    .union([z.date(), z.string()])
    .optional()
    .transform((v) => {
      if (!v || v === "" || v === "null") return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }),
});

export const updateTodoSchema = z.object({
  task: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z
    .union([z.date(), z.string()])
    .optional()
    .transform((v) => {
      if (!v || v === "" || v === "null") return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  isPinned: z.coerce.boolean().optional(),
  backgroundColor: z.string().max(100).optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  reminderAt: z
    .union([z.date(), z.string()])
    .optional()
    .transform((v) => {
      if (!v || v === "" || v === "null") return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }),
});

/** MongoDB ObjectId guard for :id params. */
export const mongoIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id format"),
});

/** Mongoose subdocument _id (e.g. a refresh-token session) is still a 24-hex ObjectId. */
export const sessionIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id format"),
  sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid sessionId format"),
});

/* ------------------------------------------------------------------ */
/* Admin panel query filters                                          */
/* ------------------------------------------------------------------ */

/** Shared pagination + date-range fields used by admin list endpoints. */
const paginationFields = {
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(200).optional().default(25),
  from: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined))
    .refine((d) => !d || !Number.isNaN(d.getTime()), "Invalid 'from' date"),
  to: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined))
    .refine((d) => !d || !Number.isNaN(d.getTime()), "Invalid 'to' date"),
};

/** GET /api/admin/users */
export const adminUsersQuery = z.object({
  ...paginationFields,
  search: z.string().trim().max(120).optional(),
  role: z.enum(["user", "admin"]).optional(),
  status: z.enum(["active", "locked", "deactivated", "unverified"]).optional(),
});

/** GET /api/admin/users/:id — none (path param only). */

/** GET /api/admin/login-history */
export const adminLoginHistoryQuery = z.object({
  ...paginationFields,
  status: z
    .enum(["success", "failed", "failed_password", "failed_locked", "failed_otp"])
    .optional(),
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid userId").optional(),
});

/** GET /api/admin/login-history/failed */
export const adminLoginFailuresQuery = z.object({
  from: paginationFields.from,
  to: paginationFields.to,
});

/** GET /api/admin/sessions/active */
export const adminSessionsQuery = z.object({
  page: paginationFields.page,
  limit: paginationFields.limit,
});

/** GET /api/admin/todos */
export const adminTodosQuery = z.object({
  ...paginationFields,
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid userId").optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  search: z.string().trim().max(200).optional(),
  includeDeleted: z.enum(["true", "false"]).optional(),
});

/** GET /api/admin/todos/stats */
export const adminTodoStatsQuery = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid userId").optional(),
});

/** GET /api/admin/todos/deleted */
export const adminDeletedTodosQuery = z.object({
  page: paginationFields.page,
  limit: paginationFields.limit,
});

/** GET /api/admin/stats/signups */
export const adminSignupsQuery = z.object({
  from: paginationFields.from,
  to: paginationFields.to,
  granularity: z.enum(["day", "week", "month"]).optional().default("day"),
});

/** GET /api/admin/stats/otp-usage */
export const adminOtpUsageQuery = z.object({
  from: paginationFields.from,
  to: paginationFields.to,
});

/** GET /api/admin/stats/login-trend */
export const adminLoginTrendQuery = z.object({
  from: paginationFields.from,
  to: paginationFields.to,
  days: z.coerce.number().int().min(7).max(90).optional().default(14),
});

/** GET /api/admin/stats/rate-limits */
export const adminRateLimitsQuery = z.object({
  ...paginationFields,
  limiter: z.string().trim().max(40).optional(),
  ip: z.string().trim().max(64).optional(),
});

/** GET /api/admin/audit-log */
export const adminAuditQuery = z.object({
  ...paginationFields,
  adminId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid adminId").optional(),
  action: z.string().trim().max(60).optional(),
});

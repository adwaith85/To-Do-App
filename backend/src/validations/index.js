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

/** Optional reCAPTCHA token (enforced server-side only when keys are set). */
const captchaField = z.string().trim().max(2048).optional();

/** The classic 6-digit OTP code. */
const otpField = z
  .string({ required_error: "Verification code is required" })
  .regex(/^\d{6}$/, "Verification code must be exactly 6 digits");

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

/**
 * Register body. Output is normalized:
 *   { name, email, password, captchaToken?, phone: "+9198...", countryCode: "IN" }
 * (confirmPassword / terms are frontend-only concerns and are stripped.)
 */
export const registerSchema = z
  .object({
    name: nameField,
    email: emailField,
    phone: phoneRawField,
    password: passwordField,
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
});

/** MongoDB ObjectId guard for :id params. */
export const mongoIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id format"),
});

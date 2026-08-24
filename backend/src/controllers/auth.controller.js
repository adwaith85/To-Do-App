/**
 * Auth controller — request/response orchestration for every auth endpoint.
 *
 * Heavy lifting is delegated:
 *  - validation      → Zod schemas via validate() middleware
 *  - token lifecycle → services/token.service.js (incl. logout blacklisting)
 *  - OTP issuing     → services/otp.service.js (email only)
 *  - captcha         → utils/captcha.util.js (active when keys configured)
 *  - history trail   → utils/history.util.js (never blocks the response)
 */
import User from "../models/user.model.js";
import { env } from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyPassword } from "../utils/password.util.js";
import { logAuthEvent } from "../utils/history.util.js";
import { assertCaptcha } from "../utils/captcha.util.js";
import {
  issueSession,
  rotateRefreshToken,
  revokeCurrentSession,
  revokeAllSessions,
  clearRefreshCookie,
} from "../services/token.service.js";
import {
  issueOtp,
  assertResendCooldown,
  verifyOtpForTarget,
} from "../services/otp.service.js";

/* ------------------------------------------------------------------ */
/* POST /api/auth/register                                             */
/* ------------------------------------------------------------------ */

/**
 * Create an UNVERIFIED user and email them a verification code.
 * The account stays inactive until POST /verify-otp succeeds.
 *
 * Protections: reCAPTCHA (optional), register rate limit (5/h/IP),
 * duplicate email/phone check, bcrypt hashing via the model hook.
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, phone, countryCode, password, captchaToken } = req.body;

  await assertCaptcha(captchaToken, "register");

  // Reject when email OR phone already belongs to a registered account.
  const existing = await User.findOne({ $or: [{ email }, { phone }] });
  if (existing) {
    await logAuthEvent({
      userId: existing._id, action: "REGISTER_BLOCKED", status: "failed", req,
    });
    throw ApiError.conflict("An account with this email or phone already exists. Try logging in.");
  }

  // isEmailVerified stays false until OTP verification completes.
  const user = await User.create({ name, email, phone, countryCode, password });

  const { delivered, devCode } = await issueOtp("email", email);

  await logAuthEvent({
    userId: user._id, action: "REGISTER_INITIATED", req,
    meta: { otpDelivered: delivered },
  });

  res.status(201).json({
    success: true,
    message: delivered
      ? `Account created. A verification code was sent to ${email} — it expires in ${env.otp.expiryMinutes} minutes.`
      : "Account created — the email could not be sent right now, use resend.",
    data: { email },
    // Dev-only convenience when SMTP isn't configured (never in production).
    ...(devCode && { devOtp: devCode }),
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/verify-otp                                           */
/* ------------------------------------------------------------------ */

/**
 * Exchange the emailed code for an activated account.
 * On success the user is logged in immediately (session pair issued).
 */
export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw ApiError.badRequest("Invalid or expired verification code.");

  if (user.isEmailVerified) {
    return res.status(200).json({
      success: true,
      message: "Email is already verified. You can log in.",
      data: { alreadyVerified: true },
    });
  }

  try {
    await verifyOtpForTarget("email", email, otp);
  } catch (error) {
    await logAuthEvent({
      userId: user._id, action: "EMAIL_VERIFY_FAILED", status: "failed",
      req, meta: { reason: error.message },
    });
    throw error;
  }

  user.isEmailVerified = true;
  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = await issueSession(user, req, res);

  await logAuthEvent({ userId: user._id, action: "EMAIL_VERIFY_SUCCESS", req });

  res.status(200).json({
    success: true,
    message: "Email verified successfully. Welcome!",
    data: { user, accessToken },
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/resend-otp                                           */
/* ------------------------------------------------------------------ */

/**
 * Re-send a fresh verification code.
 * Responds with success even when the account doesn't exist or is already
 * verified — prevents attackers from discovering which emails are registered.
 */
export const resendOtp = asyncHandler(async (req, res) => {
  const genericMessage =
    "If that account still needs verifying, a new code has been sent.";

  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user || user.isEmailVerified) {
    return res.status(200).json({ success: true, message: genericMessage });
  }

  await assertResendCooldown(email, "email"); // throws 429 when too soon

  const { delivered, devCode } = await issueOtp("email", email);
  if (!delivered && !devCode) {
    throw new ApiError(502, "Could not send the verification email. Try again later.");
  }

  await logAuthEvent({
    userId: user._id, action: "RESEND_OTP", req, meta: { delivered },
  });

  res.status(200).json({
    success: true,
    message: genericMessage,
    ...(devCode && { devOtp: devCode }), // dev-only fallback (see register)
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/login                                                */
/* ------------------------------------------------------------------ */

/**
 * Credential check → session pair (access token + refresh cookie).
 *
 * Brute-force defenses stacked here:
 *  1. reCAPTCHA v3 (when configured)
 *  2. per-account lockout after N failures (lockUntil)
 *  3. timing-equalized responses so unknown emails look like bad passwords
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password, captchaToken } = req.body;

  await assertCaptcha(captchaToken, "login");

  // +password: field has select:false by default for safety elsewhere.
  const user = await User.findOne({ email }).select("+password");

  /* ---- Unknown email: burn comparable CPU time to defeat timing attacks ---- */
  if (!user) {
    await verifyPassword(password, "$2a$12$C6UzMDM.H6dfI/f/IKcEeO1R9cD7nFt0QkCwLPUnZ0eKBHhP1JBTO");
    await logAuthEvent({
      action: "LOGIN_FAILED", status: "failed",
      req, meta: { reason: "unknown_email" },
    });
    throw ApiError.unauthorized("Incorrect email or password.");
  }

  /* ---- Locked account? ---- */
  if (user.isLocked()) {
    await logAuthEvent({
      userId: user._id, action: "LOGIN_BLOCKED_LOCKED", status: "failed", req,
    });
    throw new ApiError(
      423, // 423 Locked
      `Account temporarily locked due to failed attempts. Try again in ${user.minutesUntilUnlock()} minute(s).`,
      [],
      "ACCOUNT_LOCKED"
    );
  }

  /* ---- Wrong password: count it, maybe lock ---- */
  const matches = await user.comparePassword(password);
  if (!matches) {
    await user.registerFailedLogin();
    await logAuthEvent({
      userId: user._id, action: "LOGIN_FAILED", status: "failed",
      req, meta: { reason: "bad_password", attempts: user.failedLoginAttempts },
    });

    if (user.isLocked()) {
      throw new ApiError(
        423,
        `Too many failed attempts — account locked for ${user.minutesUntilUnlock()} minute(s).`,
        [],
        "ACCOUNT_LOCKED"
      );
    }
    throw ApiError.unauthorized("Incorrect email or password.");
  }

  /* ---- Verification gate ---- */
  if (!user.isEmailVerified) {
    await logAuthEvent({
      userId: user._id, action: "LOGIN_BLOCKED_UNVERIFIED", status: "failed", req,
    });
    throw new ApiError(403, "Please verify your email first.", [], "EMAIL_NOT_VERIFIED");
  }

  /* ---- Success: clear counters + mint session ---- */
  await user.resetLoginFailures();
  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = await issueSession(user, req, res);

  await logAuthEvent({ userId: user._id, action: "LOGIN_SUCCESS", req });

  res.status(200).json({
    success: true,
    message: "Logged in successfully.",
    data: { user, accessToken },
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/refresh-token                                        */
/* ------------------------------------------------------------------ */

/**
 * Silent session renewal. The browser sends the httpOnly cookie; a valid
 * token is ROTATED into a new pair. Logged-out tokens are rejected via
 * the blacklist; replayed tokens trigger a full revoke.
 */
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const { accessToken, user } = await rotateRefreshToken(
    req.cookies?.refreshToken || "",
    req,
    res
  );

  await logAuthEvent({ userId: user._id, action: "TOKEN_REFRESHED", req });

  res.status(200).json({
    success: true,
    message: "Token refreshed.",
    data: { user, accessToken },
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/logout                                               */
/* ------------------------------------------------------------------ */

/**
 * Kill the current device's session server-side and clear the cookie.
 * The presented refresh token is BLACKLISTED so it can never be reused —
 * a hacker holding this exact token afterwards gets "access denied".
 */
export const logout = asyncHandler(async (req, res) => {
  const userId = await revokeCurrentSession(req, res);
  clearRefreshCookie(res); // always, even without a valid cookie

  if (userId) await logAuthEvent({ userId, action: "LOGOUT", req });

  res.status(200).json({ success: true, message: "Logged out successfully." });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/logout-all                                           */
/* ------------------------------------------------------------------ */

/** Revoke + blacklist every session across ALL devices. */
export const logoutAll = asyncHandler(async (req, res) => {
  await revokeAllSessions(req.user._id);
  clearRefreshCookie(res);

  await logAuthEvent({ userId: req.user._id, action: "LOGOUT_ALL", req });

  res.status(200).json({ success: true, message: "Logged out from all devices." });
});

/* ------------------------------------------------------------------ */
/* GET /api/auth/me                                                    */
/* ------------------------------------------------------------------ */

/** Current user profile — handy for bootstrapping the UI after reloads. */
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { user: req.user } });
});

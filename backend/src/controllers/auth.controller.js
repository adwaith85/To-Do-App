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
import LoginHistory from "../models/loginHistory.model.js";
import { env } from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyPassword } from "../utils/password.util.js";
import { logAuthEvent, getClientIp, getDevice } from "../utils/history.util.js";
import { assertCaptcha, verifyCaptcha } from "../utils/captcha.util.js";
import { sendNewLoginAlert, sendOtpEmail } from "../utils/mailer.util.js";
import {
  issueSession,
  rotateRefreshToken,
  revokeCurrentSession,
  revokeAllSessions,
  revokeSessionById,
  listSessions,
  clearRefreshCookie,
  getRefreshTokenFromRequest,
} from "../services/token.service.js";
import {
  issueOtp,
  assertResendCooldown,
  verifyOtpForTarget,
} from "../services/otp.service.js";
import {
  signTwoFactorPendingToken,
  verifyTwoFactorPendingToken,
  signSignupToken,
  verifySignupToken,
} from "../utils/jwt.util.js";

/* ------------------------------------------------------------------ */
/* POST /api/auth/register                                             */
/* ------------------------------------------------------------------ */

/**
 * Create an UNVERIFIED user and email them a verification code.
 * The account starts WITHOUT a password — step 1 of the signup wizard:
 *   register (name/email/phone) → verify-otp → set-password → login
 *
 * Protections: reCAPTCHA (optional), register rate limit (5/h/IP),
 * duplicate email/phone check.
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, phone, countryCode, captchaToken } = req.body;

  await assertCaptcha(captchaToken, "register");

  // Reject when email OR phone already belongs to a registered account.
  const existing = await User.findOne({ $or: [{ email }, { phone }] });
  if (existing) {
    await logAuthEvent({
      userId: existing._id, action: "REGISTER_BLOCKED", status: "failed", req,
    });
    throw ApiError.conflict("An account with this email or phone already exists. Try logging in.");
  }

  // isEmailVerified stays false; password is set after verification.
  const user = await User.create({ name, email, phone, countryCode });

  const { delivered, devCode } = await issueOtp("email", email, user._id);

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
 * Exchange the emailed code for an activated account — the middle step of
 * the signup wizard. When the account still has NO password (the normal
 * signup path) this returns a short-lived signupToken instead of a session,
 * so the SAME page can immediately collect the password (set-password).
 * Accounts that already carry a password are logged in as before.
 */
export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email }).select("+password");
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
  user.isActive = true; // verified = an active account
  const finishLogin = Boolean(user.password); // legacy accounts verify WITH a password
  if (finishLogin) {
    user.lastLoginAt = new Date();
    user.lastLoginIp = getClientIp(req);
  }
  await user.save();

  await logAuthEvent({ userId: user._id, action: "EMAIL_VERIFY_SUCCESS", req });

  if (finishLogin) {
    const accessToken = await issueSession(user, req, res);
    return res.status(200).json({
      success: true,
      message: "Email verified successfully. Welcome!",
      data: { user, accessToken },
    });
  }

  // Verify → password step: the wizard stays on the same page.
  const signupToken = signSignupToken(user);
  res.status(200).json({
    success: true,
    message: "Email verified. Now create your password to finish.",
    data: { verified: true, signupToken },
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/set-password                                         */
/* ------------------------------------------------------------------ */

/**
 * Final step of signup: the email was just verified (signupToken proves
 * it), so the user picks a password. No session is minted — the wizard
 * redirects to /login afterwards, per the requested flow.
 */
export const setPassword = asyncHandler(async (req, res) => {
  const { signupToken, password } = req.body;

  const payload = verifySignupToken(signupToken); // throws 400 SIGNUP_TOKEN_EXPIRED

  const user = await User.findById(payload.sub).select("+password");
  if (!user || !user.isEmailVerified) {
    throw ApiError.badRequest("Account not found. Please register again.");
  }
  if (user.password) {
    throw ApiError.badRequest("A password already exists for this account. Log in instead.");
  }

  user.password = password; // pre-save hook hashes it (bcrypt 12)
  await user.save();

  await logAuthEvent({ userId: user._id, action: "PASSWORD_CREATED", req });

  res.status(200).json({
    success: true,
    message: "Registered successfully. You can now log in with your email and password.",
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

  const { delivered, devCode } = await issueOtp("email", email, user._id);
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
/* Shared login helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * Suspicious-login detection: has this account EVER logged in from this
 * exact IP + user-agent before? If not, email a security alert.
 * Never throws — the alert must not break the login itself.
 */
async function maybeAlertNewDevice(user, req) {
  try {
    const seen = await LoginHistory.exists({
      user: user._id,
      action: "LOGIN_SUCCESS",
      ip: getClientIp(req),
      device: getDevice(req),
    });
    if (seen) return { suspicious: false, alerted: false };

    const { delivered } = await sendNewLoginAlert(user.email, {
      ip: getClientIp(req),
      device: getDevice(req),
      when: new Date().toUTCString(),
    });
    return { suspicious: true, alerted: delivered };
  } catch (error) {
    console.error("[auth] new-device alert failed:", error.message);
    return { suspicious: true, alerted: false };
  }
}

/** Shared tail of every successful credential grant (with or without 2FA). */
async function grantLoginSession(user, req, res, { rememberMe = false }) {
  await user.resetLoginFailures();
  user.lastLoginAt = new Date();
  user.lastLoginIp = getClientIp(req);
  await user.save();

  const accessToken = await issueSession(user, req, res, { rememberMe });

  const { suspicious, alerted } = await maybeAlertNewDevice(user, req);
  await logAuthEvent({
    userId: user._id,
    action: "LOGIN_SUCCESS",
    req,
    meta: { rememberMe, suspicious, alertEmailed: alerted },
  });

  return accessToken;
}

/* ------------------------------------------------------------------ */
/* POST /api/auth/login                                                */
/* ------------------------------------------------------------------ */

/**
 * Credential check → session pair (access token + refresh cookie).
 * Identifier may be an EMAIL or a PHONE number; `rememberMe` stretches the
 * refresh cookie from 7 to 30 days.
 *
 * When the user opted into 2FA, NO session is issued here — instead a
 * short-lived pendingToken is returned and a code is emailed; the client
 * finishes with POST /verify-login-otp.
 *
 * Brute-force defenses stacked here:
 *  1. reCAPTCHA v3 (when configured)
 *  2. per-account lockout after N failures (lockUntil)
 *  3. timing-equalized responses so unknown emails look like bad passwords
 */
export const login = asyncHandler(async (req, res) => {
  // Zod normalized the identifier into {email} OR {phone}.
  const identifier = req.body.email;
  const { password, rememberMe, captchaToken, captcha } = req.body;

  await assertCaptcha(captchaToken, "login");

  // Visual captcha gate runs BEFORE any credential work.
  if (!captcha || !verifyCaptcha(captcha.token, captcha.text)) {
    throw ApiError.badRequest(
      "Captcha code is incorrect. Please try again.",
      [],
      "CAPTCHA_FAILED"
    );
  }

  const query = identifier.email ? { email: identifier.email } : { phone: identifier.phone };

  // +password: field has select:false by default for safety elsewhere.
  const user = await User.findOne(query).select("+password");

  /* ---- Unknown identity: burn comparable CPU time to defeat timing attacks ---- */
  if (!user) {
    await verifyPassword(password, "$2a$12$C6UzMDM.H6dfI/f/IKcEeO1R9cD7nFt0QkCwLPUnZ0eKBHhP1JBTO");
    await logAuthEvent({
      action: "LOGIN_FAILED", status: "failed_password",
      req, meta: { reason: "unknown_identifier" },
    });
    throw ApiError.unauthorized("Incorrect credentials.");
  }

  /* ---- Soft-deleted account? Same generic error (no existence leak). ---- */
  if (user.isDeleted) {
    await logAuthEvent({
      userId: user._id, action: "LOGIN_FAILED", status: "failed_locked",
      req, meta: { reason: "account_deleted" },
    });
    throw ApiError.unauthorized("Incorrect credentials.");
  }

  /* ---- Locked account? ---- */
  if (user.isLocked()) {
    await logAuthEvent({
      userId: user._id, action: "LOGIN_BLOCKED_LOCKED", status: "failed_locked", req,
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
      userId: user._id, action: "LOGIN_FAILED", status: "failed_password",
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
    throw ApiError.unauthorized("Incorrect credentials.");
  }

  /* ---- Verification gate ---- */
  if (!user.isEmailVerified) {
    await logAuthEvent({
      userId: user._id, action: "LOGIN_BLOCKED_UNVERIFIED", status: "failed", req,
    });
    throw new ApiError(403, "Please verify your email first.", [], "EMAIL_NOT_VERIFIED");
  }

  /* ---- Two-factor branch: hold the session until the code checks out ---- */
  if (user.twoFactorEnabled) {
    const pendingToken = signTwoFactorPendingToken(user);
    const { delivered, devCode } = await issueOtp("login_2fa", user.email, user._id);

    await logAuthEvent({
      userId: user._id, action: "LOGIN_2FA_PENDING", req,
      meta: { rememberMe, otpDelivered: delivered },
    });

    const maskedEmail = user.email.replace(/^(.).*(@.*)$/, "$1*****$2");
    return res.status(200).json({
      success: true,
      message: `We emailed a sign-in code to ${maskedEmail}. It expires in ${env.otp.expiryMinutes} minutes.`,
      data: { twoFactorRequired: true, pendingToken },
      ...(devCode && { devOtp: devCode }), // dev-only fallback (SMTP off)
    });
  }

  /* ---- Success path ---- */
  const accessToken = await grantLoginSession(user, req, res, { rememberMe });

  res.status(200).json({
    success: true,
    message: "Logged in successfully.",
    data: { user, accessToken },
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/verify-login-otp                                     */
/* ------------------------------------------------------------------ */

/**
 * Second factor of a 2FA login: exchange {pendingToken, otp} for the real
 * session pair. The pending token proves the PASSWORD step already passed;
 * it expires quickly and grants nothing by itself.
 */
export const verifyLoginOtp = asyncHandler(async (req, res) => {
  const { pendingToken, otp, rememberMe } = req.body;

  let payload;
  try {
    payload = verifyTwoFactorPendingToken(pendingToken);
  } catch (error) {
    await logAuthEvent({
      action: "LOGIN_2FA_FAILED", status: "failed_otp",
      req, meta: { reason: "pending_token_invalid" },
    });
    throw error;
  }

  const user = await User.findById(payload.sub).select("+password");
  if (!user || !user.isEmailVerified) {
    throw ApiError.unauthorized("Login session expired. Please sign in again.", "TWO_FACTOR_EXPIRED");
  }
  if (user.isDeleted) {
    throw ApiError.unauthorized("This account is no longer active.", "ACCOUNT_DEACTIVATED");
  }
  if (user.isLocked()) {
    throw new ApiError(423, "Account temporarily locked. Try again later.", [], "ACCOUNT_LOCKED");
  }

  try {
    await verifyOtpForTarget("login_2fa", user.email, otp);
  } catch (error) {
    await logAuthEvent({
      userId: user._id, action: "LOGIN_2FA_FAILED", status: "failed_otp",
      req, meta: { reason: error.message },
    });
    throw error;
  }

  const accessToken = await grantLoginSession(user, req, res, { rememberMe });

  await logAuthEvent({ userId: user._id, action: "LOGIN_2FA_SUCCESS", req });

  res.status(200).json({
    success: true,
    message: "Logged in successfully.",
    data: { user, accessToken },
  });
});

/* ------------------------------------------------------------------ */
/* Device/session management                                           */
/* ------------------------------------------------------------------ */

/** GET /api/auth/sessions — every active device session for this account. */
export const getSessions = asyncHandler(async (req, res) => {
  const sessions = await listSessions(req.user._id, getRefreshTokenFromRequest(req));
  res.status(200).json({ success: true, data: { sessions } });
});

/**
 * DELETE /api/auth/sessions/:id — revoke one device remotely.
 * Revoking the CURRENT device also clears its refresh cookie.
 */
export const revokeSession = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await revokeSessionById(
    req.user._id,
    id,
    getRefreshTokenFromRequest(req)
  );
  if (!result.existed) throw ApiError.notFound("Session not found.");

  if (result.wasCurrent) clearRefreshCookie(res);

  await logAuthEvent({
    userId: req.user._id, action: "SESSION_REVOKED", req, meta: { sessionId: id },
  });

  res.status(200).json({
    success: true,
    message: result.wasCurrent
      ? "This device was signed out."
      : "That device was signed out.",
  });
});

/**
 * PATCH /api/auth/2fa — turn the email second factor on/off per user.
 */
export const toggleTwoFactor = asyncHandler(async (req, res) => {
  const { enabled } = req.body;

  const user = await User.findById(req.user._id);
  user.twoFactorEnabled = enabled;
  await user.save();

  await logAuthEvent({
    userId: user._id, action: "TWO_FACTOR_TOGGLED", req, meta: { enabled },
  });

  res.status(200).json({
    success: true,
    message: enabled
      ? "Two-factor authentication is ON — codes will be emailed at sign-in."
      : "Two-factor authentication is OFF.",
    data: { user },
  });
});

/* ------------------------------------------------------------------ */
/* Password reset                                                      */
/* ------------------------------------------------------------------ */

/**
 * POST /api/auth/forgot-password — email a single-use reset code.
 * ALWAYS answers generically so attackers can't probe which emails exist.
 * The same tight limiter guards both reset endpoints (mail-bomb guard).
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const genericMessage =
    "If that email belongs to an account, a reset code has been sent — it expires shortly.";

  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(200).json({ success: true, message: genericMessage });
  }

  const { delivered, devCode } = await issueOtp("password_reset", email, user._id);

  await logAuthEvent({
    userId: user._id, action: "PASSWORD_RESET_REQUESTED", req, meta: { delivered },
  });

  res.status(200).json({
    success: true,
    message: genericMessage,
    ...(devCode && { devOtp: devCode }), // dev-only fallback (SMTP off)
  });
});

/**
 * POST /api/auth/reset-password — consume the code, set the new password,
 * then KILL EVERY active session (stolen cookies stop working instantly).
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user) throw ApiError.badRequest("Invalid or expired reset code.");

  try {
    await verifyOtpForTarget("password_reset", email, otp);
  } catch (error) {
    await logAuthEvent({
      userId: user._id, action: "PASSWORD_RESET_REQUESTED", status: "failed",
      req, meta: { reason: error.message },
    });
    throw ApiError.badRequest("Invalid or expired reset code.");
  }

  user.password = newPassword; // pre-save hook hashes it (bcrypt 12)
  user.failedLoginAttempts = 0; // give the legitimate owner a clean slate
  user.lockUntil = null;
  await user.save();

  // Spec requirement: invalidate ALL existing refresh tokens after a reset.
  await revokeAllSessions(user._id);
  clearRefreshCookie(res);

  await logAuthEvent({ userId: user._id, action: "PASSWORD_RESET_SUCCESS", req });

  res.status(200).json({
    success: true,
    message: "Password updated. Please sign in with your new password.",
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

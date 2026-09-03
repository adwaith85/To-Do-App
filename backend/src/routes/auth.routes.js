/**
 * Auth routes → mounted at /api/auth.
 *
 * Rate limiting tiers:
 *  - registerLimiter       : 5 requests/IP/hour (spec requirement)
 *  - authLimiter           : strict budget on credential/OTP endpoints
 *  - passwordResetLimiter  : 5 requests/IP/hour on forgot/reset password
 *
 * Every body passes through the NoSQL/XSS sanitizer first, then Zod.
 * CSRF double-submit guards the two cookie-trusting mutations
 * (refresh-token, logout); everything else rides the Bearer header.
 */
import { Router } from "express";
import { validate } from "../middleware/validate.middleware.js";
import { sanitize } from "../middleware/sanitize.middleware.js";
import { requireAuth, authorize } from "../middleware/auth.middleware.js";
import { requireCsrf } from "../middleware/csrf.middleware.js";
import {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
} from "../middleware/rateLimiter.middleware.js";
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  verifyLoginOtp,
  refreshAccessToken,
  autoLogin,
  logout,
  logoutAll,
  getMe,
  getSessions,
  revokeSession,
  toggleTwoFactor,
  forgotPassword,
  resetPassword,
  setPassword,
} from "../controllers/auth.controller.js";
import { adminPing } from "../controllers/admin.controller.js";
import {
  registerSchema,
  setPasswordSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  verifyLoginOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  twoFactorSchema,
  mongoIdParamSchema,
} from "../validations/index.js";
import { createCaptcha } from "../utils/captcha.util.js";

const router = Router();

/* Public — visual captcha used by the login screen. */
router.get("/captcha", (req, res) => {
  const { svg, token, expiresIn } = createCaptcha();
  res.status(200).json({ success: true, data: { svg, token, expiresIn } });
});

/* Public — account creation & verification. */
router.post("/register",     registerLimiter, sanitize, validate({ body: registerSchema }), register);
router.post("/verify-otp",   authLimiter,     sanitize, validate({ body: verifyOtpSchema }), verifyOtp);
router.post("/resend-otp",   authLimiter,     sanitize, validate({ body: resendOtpSchema }), resendOtp);

/* Public — finish signup (email verified → password chosen on same page). */
router.post("/set-password", authLimiter, sanitize, validate({ body: setPasswordSchema }), setPassword);

/* Public — login (+ optional second factor) and password reset. */
router.post("/login",              authLimiter, sanitize, validate({ body: loginSchema }), login);
router.post("/verify-login-otp",   authLimiter, sanitize, validate({ body: verifyLoginOtpSchema }), verifyLoginOtp);
router.post("/forgot-password",    passwordResetLimiter, sanitize, validate({ body: forgotPasswordSchema }), forgotPassword);
router.post("/reset-password",     passwordResetLimiter, sanitize, validate({ body: resetPasswordSchema }), resetPassword);

/* Public — session lifecycle. Cookie-authenticated → CSRF-protected. */
router.post("/refresh-token", requireCsrf, refreshAccessToken);
router.post("/auto-login",   autoLogin); // no CSRF needed — read-only cookie check
router.post("/logout",        requireCsrf, logout); // idempotent; blacklists token

/* Protected — requires a valid Bearer access token. */
router.get("/me",           requireAuth, getMe);
router.get("/sessions",     requireAuth, getSessions);
router.delete(
  "/sessions/:id",
  requireAuth,
  validate({ params: mongoIdParamSchema }),
  revokeSession
);
router.patch("/2fa",        requireAuth, sanitize, validate({ body: twoFactorSchema }), toggleTwoFactor);
router.post("/logout-all",  requireAuth, logoutAll);

/* Role-based access demo: only admins pass the authorize("admin") gate. */
router.get("/admin/ping", requireAuth, authorize("admin"), adminPing);

export default router;

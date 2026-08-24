/**
 * Auth routes → mounted at /api/auth.
 *
 * Rate limiting tiers:
 *  - registerLimiter : 5 requests/IP/hour (spec requirement)
 *  - authLimiter     : strict budget on all other credential endpoints
 * Every body passes through the NoSQL/XSS sanitizer first, then Zod.
 */
import { Router } from "express";
import { validate } from "../middleware/validate.middleware.js";
import { sanitize } from "../middleware/sanitize.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authLimiter, registerLimiter } from "../middleware/rateLimiter.middleware.js";
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  refreshAccessToken,
  logout,
  logoutAll,
  getMe,
} from "../controllers/auth.controller.js";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
} from "../validations/index.js";

const router = Router();

/* Public — account creation & verification. */
router.post("/register",   registerLimiter, sanitize, validate({ body: registerSchema }), register);
router.post("/verify-otp", authLimiter,     sanitize, validate({ body: verifyOtpSchema }), verifyOtp);
router.post("/resend-otp", authLimiter,     sanitize, validate({ body: resendOtpSchema }), resendOtp);

/* Public — session lifecycle. */
router.post("/login",         authLimiter, sanitize, validate({ body: loginSchema }), login);
router.post("/refresh-token", refreshAccessToken); // cookie-carried; rotation guards abuse
router.post("/logout",        logout);        // idempotent; blacklists the token

/* Protected — requires a valid Bearer access token. */
router.get("/me", requireAuth, getMe);
router.post("/logout-all", requireAuth, logoutAll);

export default router;

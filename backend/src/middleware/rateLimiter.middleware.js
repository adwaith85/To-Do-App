/**
 * Express rate limiters.
 *
 * Three tiers:
 *  - registerLimiter : 5 requests/IP/hour  (spec requirement)
 *  - authLimiter     : strict per-IP budget on credential/OTP endpoints
 *  - apiLimiter      : generous ceiling for the whole API
 *
 * All limits are env-tunable so local testing isn't painful — defaults
 * match the production policy.
 */
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import RateLimitLog from "../models/rateLimitLog.model.js";
import { getClientIp, getDevice } from "../utils/history.util.js";

/**
 * Fire-and-forget record of this 429 so admins can spot abuse patterns.
 * Never throws — a logging failure must not block the response.
 */
async function recordRateLimitHit(req, limiter) {
  try {
    await RateLimitLog.create({
      ip: getClientIp(req),
      userId: req.user?._id || null,
      method: req.method,
      path: req.originalUrl || req.path || "",
      limiter,
      userAgent: getDevice(req),
    });
  } catch (error) {
    console.error("[rate-limit] Failed to log rate-limit hit:", error.message);
  }
}

/** Shared response shape so the frontend can render one error style. */
function limiterHandler(limiter, message) {
  return async (req, res) => {
    // recordRateLimitHit may be mid-write; don't block the 429.
    void recordRateLimitHit(req, limiter);
    res.status(429).json({ success: false, message });
  };
}

const standardOptions = {
  standardHeaders: true, // RateLimit-* headers for clients/proxies
  legacyHeaders: false,  // drop deprecated X-RateLimit-* headers
};

/** Registration: max 5 requests / IP / hour. */
export const registerLimiter = rateLimit({
  windowMs: parseInt(env.rateLimits.registerWindowMinutes, 10) * 60_000,
  limit: parseInt(env.rateLimits.registerMax, 10),
  ...standardOptions,
  handler: limiterHandler("register", "Too many registration attempts from this IP. Please try again later."),
});

/** Login / OTP endpoints: default 20 attempts / 15 min / IP. */
export const authLimiter = rateLimit({
  windowMs: parseInt(env.rateLimits.authWindowMinutes, 10) * 60_000,
  limit: parseInt(env.rateLimits.authMax, 10),
  ...standardOptions,
  handler: limiterHandler(
    "auth",
    `Too many authentication attempts. Please try again in ${env.rateLimits.authWindowMinutes} minutes.`
  ),
});

/**
 * Forgot/reset password: max 5 requests / IP / hour.
 * These endpoints email real humans — a tight budget prevents mail bombing
 * and token brute-forcing from a single machine.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: parseInt(env.rateLimits.passwordResetWindowMinutes, 10) * 60_000,
  limit: parseInt(env.rateLimits.passwordResetMax, 10),
  ...standardOptions,
  handler: limiterHandler("password_reset", "Too many password reset attempts. Please try again later."),
});

/** Whole-API limiter: default 300 requests / 15 min / IP. */
export const apiLimiter = rateLimit({
  windowMs: parseInt(env.rateLimits.apiWindowMinutes, 10) * 60_000,
  limit: parseInt(env.rateLimits.apiMax, 10),
  ...standardOptions,
  handler: limiterHandler("api", "Too many requests from this IP. Please try again later."),
});

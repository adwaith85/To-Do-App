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

/** Shared response shape so the frontend can render one error style. */
function limiterHandler(message) {
  return (_req, res) => {
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
  handler: limiterHandler("Too many registration attempts from this IP. Please try again later."),
});

/** Login / OTP endpoints: default 20 attempts / 15 min / IP. */
export const authLimiter = rateLimit({
  windowMs: parseInt(env.rateLimits.authWindowMinutes, 10) * 60_000,
  limit: parseInt(env.rateLimits.authMax, 10),
  ...standardOptions,
  handler: limiterHandler(
    `Too many authentication attempts. Please try again in ${env.rateLimits.authWindowMinutes} minutes.`
  ),
});

/** Whole-API limiter: default 300 requests / 15 min / IP. */
export const apiLimiter = rateLimit({
  windowMs: parseInt(env.rateLimits.apiWindowMinutes, 10) * 60_000,
  limit: parseInt(env.rateLimits.apiMax, 10),
  ...standardOptions,
  handler: limiterHandler("Too many requests from this IP. Please try again later."),
});

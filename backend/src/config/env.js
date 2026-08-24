/**
 * Centralized environment configuration.
 *
 * Every module imports its settings from here instead of calling
 * process.env directly. This gives us one place to:
 *   - document every variable the app expects
 *   - validate required secrets (fail fast in production)
 *   - provide safe development fallbacks
 */
import dotenv from "dotenv";
import crypto from "crypto";

// Load variables from backend/.env into process.env (once).
dotenv.config();

const isProd = process.env.NODE_ENV === "production";

/**
 * Read a required variable. In production a missing secret crashes the app
 * on boot (fail fast). In development we fall back to an ephemeral random
 * value so the server can still start, with a loud warning.
 */
function requireSecret(key) {
  const value = process.env[key];
  if (value) return value;

  if (isProd) {
    throw new Error(
      `[config] Missing required environment variable "${key}". Set it in .env before running in production.`
    );
  }

  const devValue = crypto.randomBytes(32).toString("hex");
  console.warn(
    `[config] WARNING: "${key}" is not set. Using an ephemeral dev value — ` +
      `tokens/sessions will be invalidated on restart. Add it to backend/.env for stable local dev.`
  );
  return devValue;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd,
  isTest: process.env.NODE_ENV === "test",

  port: parseInt(process.env.PORT || "5050", 10),

  // MongoDB connection string.
  mongoUri:
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    "mongodb://127.0.0.1:27017/todoapp",

  // Frontend origin allowed by CORS.
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",

  jwt: {
    accessSecret: requireSecret("JWT_ACCESS_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshSecret: requireSecret("JWT_REFRESH_SECRET"),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    // Refresh TTL in ms — used for cookie Max-Age.
    refreshTtlMs: parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN || "7d"),
  },

  cookies: {
    refreshTokenName: process.env.REFRESH_TOKEN_COOKIE_NAME || "refreshToken",
    // "lax" fits same-site deployments (localhost dev included);
    // switch to "none" (+ HTTPS) only if API and client live on different sites.
    sameSite: process.env.COOKIE_SAMESITE || "lax",
  },

  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10),
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || "60", 10),
  },

  /** Account lockout after repeated failed logins (brute-force defense). */
  lockout: {
    maxFailedAttempts: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || "5", 10),
    lockMinutes: parseInt(process.env.LOCK_TIME_MINUTES || "30", 10),
  },

  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || "Secure Todo <no-reply@todoapp.local>",
  },

  /**
   * Google reCAPTCHA (optional v3). When RECAPTCHA_SECRET_KEY is set,
   * register/login REQUIRE a valid captchaToken from the frontend.
   */
  recaptcha: {
    secretKey: process.env.RECAPTCHA_SECRET_KEY || "",
    minScore: parseFloat(process.env.RECAPTCHA_MIN_SCORE || "0.5"),
  },

  /** HTTP rate-limit budgets. Defaults match the documented policy. */
  rateLimits: {
    registerMax: process.env.REGISTER_RATE_LIMIT_MAX || "5",
    registerWindowMinutes: process.env.REGISTER_RATE_LIMIT_WINDOW_MINUTES || "60",
    authMax: process.env.AUTH_RATE_LIMIT_MAX || "20",
    authWindowMinutes: process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES || "15",
    apiMax: process.env.API_RATE_LIMIT_MAX || "300",
    apiWindowMinutes: process.env.API_RATE_LIMIT_WINDOW_MINUTES || "15",
  },
};

/** Parse values like "7d", "15m", "3600s" or plain seconds into milliseconds. */
function parseDurationMs(value) {
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(String(value).trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default: 7 days

  const amount = parseInt(match[1], 10);
  const unit = (match[2] || "s").toLowerCase();
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
}

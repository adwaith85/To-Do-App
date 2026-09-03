import dotenv from "dotenv";

dotenv.config();

const isProd = process.env.NODE_ENV === "production";

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd,
  isTest: process.env.NODE_ENV === "test",

  port: parseInt(process.env.PORT || "5050", 10),

  mongoUri: process.env.MONGO_URI || process.env.MONGO_URL,

  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    refreshRememberExpiresIn: process.env.JWT_REFRESH_REMEMBER_EXPIRES_IN || "30d",
    twoFactorExpiresIn: process.env.TWO_FACTOR_PENDING_TTL || "10m",
    refreshTtlMs: parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN || "7d"),
    refreshRememberTtlMs: parseDurationMs(process.env.JWT_REFRESH_REMEMBER_EXPIRES_IN || "30d"),
  },

  cookies: {
    refreshTokenName: process.env.REFRESH_TOKEN_COOKIE_NAME || "refreshToken",
    rememberMeName: process.env.REMEMBER_ME_COOKIE_NAME || "rememberMe",
    csrfTokenName: process.env.CSRF_COOKIE_NAME || "csrfToken",
    sessionMarkerName: process.env.SESSION_MARKER_COOKIE_NAME || "appSession",
    sameSite: process.env.COOKIE_SAMESITE || "lax",
  },

  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10),
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || "60", 10),
  },

  lockout: {
    maxFailedAttempts: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || "5", 10),
    lockMinutes: parseInt(process.env.LOCK_TIME_MINUTES || "60", 10),
  },

  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || "Secure Todo <no-reply@todoapp.local>",
  },

  recaptcha: {
    secretKey: process.env.RECAPTCHA_SECRET_KEY || "",
    minScore: parseFloat(process.env.RECAPTCHA_MIN_SCORE || "0.5"),
  },

  rateLimits: {
    registerMax: process.env.REGISTER_RATE_LIMIT_MAX || "5",
    registerWindowMinutes: process.env.REGISTER_RATE_LIMIT_WINDOW_MINUTES || "60",
    authMax: process.env.AUTH_RATE_LIMIT_MAX || "20",
    authWindowMinutes: process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES || "15",
    apiMax: process.env.API_RATE_LIMIT_MAX || "300",
    apiWindowMinutes: process.env.API_RATE_LIMIT_WINDOW_MINUTES || "15",
    passwordResetMax: process.env.PASSWORD_RESET_RATE_LIMIT_MAX || "5",
    passwordResetWindowMinutes: process.env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES || "60",
  },
};

function parseDurationMs(value) {
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(String(value).trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = parseInt(match[1], 10);
  const unit = (match[2] || "s").toLowerCase();
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
}

/**
 * LoginHistory model — append-only audit trail of auth events.
 *
 * Every entry answers: WHO did WHAT from WHERE, and did it SUCCEED?
 * A TTL index prunes entries after 90 days so the collection stays small.
 */
import mongoose from "mongoose";

export const AUDIT_ACTIONS = [
  "REGISTER_INITIATED",       // user submitted the register form
  "REGISTER_BLOCKED",         // register attempt for an already-verified account
  "RESEND_OTP",
  "EMAIL_VERIFY_SUCCESS",     // email verified via OTP
  "EMAIL_VERIFY_FAILED",
  "PHONE_VERIFY_SUCCESS",     // phone verified via SMS OTP
  "PHONE_VERIFY_FAILED",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGIN_BLOCKED_LOCKED",     // attempt while account was locked out
  "LOGIN_BLOCKED_UNVERIFIED", // attempt before email/phone verification
  "LOGIN_2FA_PENDING",        // password OK, waiting for the second factor
  "LOGIN_2FA_SUCCESS",        // second factor accepted → session granted
  "LOGIN_2FA_FAILED",         // wrong/expired 2FA code
  "PASSWORD_RESET_REQUESTED", // forgot-password asked for a reset code
  "PASSWORD_RESET_SUCCESS",   // password actually changed via code
  "SESSION_REVOKED",          // one device session killed from sessions UI
  "TWO_FACTOR_TOGGLED",       // user switched 2FA on/off
  "TOKEN_REFRESHED",
  "TOKEN_REUSE_DETECTED",     // rotated token replayed → all sessions revoked
  "LOGOUT",
  "LOGOUT_ALL",
];

const loginHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null when no user could be resolved (e.g. unknown email)
      index: true,
    },
    /** What the visitor typed — email or phone — as submitted. */
    emailOrPhone: { type: String, default: "" },
    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: true,
    },
    /**
     * Spec-backing detailed outcome. "failed_*" subtypes are used for
     * login attempts; plain "failed"/"success" covers every other event.
     */
    status: {
      type: String,
      enum: [
        "success",
        "failed",
        "failed_password",
        "failed_locked",
        "failed_otp",
      ],
      default: "success",
    },
    reason: { type: String, default: "" }, // human-readable failure context
    ip: { type: String, default: "unknown" },
    device: { type: String, default: "unknown" }, // user-agent string
    location: { type: String, default: "" },       // optional IP-geo lookup
    // Small free-form context (never store passwords/tokens here).
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true } // createdAt doubles as the event timestamp
);

// Fast per-user audit queries (why a user was locked, recent sign-ins).
loginHistorySchema.index({ user: 1, createdAt: -1 });
// 90-day retention via TTL index.
loginHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const LoginHistory = mongoose.model("LoginHistory", loginHistorySchema);
export default LoginHistory;

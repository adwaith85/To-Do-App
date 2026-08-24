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
    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: true,
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },
    ip: { type: String, default: "unknown" },
    device: { type: String, default: "unknown" }, // user-agent string
    location: { type: String, default: "" },       // optional IP-geo lookup
    // Small free-form context (never store passwords/tokens here).
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true } // createdAt doubles as the event timestamp
);

// 90-day retention via TTL index.
loginHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const LoginHistory = mongoose.model("LoginHistory", loginHistorySchema);
export default LoginHistory;

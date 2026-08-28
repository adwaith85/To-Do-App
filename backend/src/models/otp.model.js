/**
 * Otp model — hashed one-time codes for email / phone / password reset.
 *
 * One active code per (target, type). Issuing a new code overwrites the
 * previous one (upsert), so old codes stop working instantly.
 * `target` is the delivery identifier from the spec: the email address or
 * E.164 phone number the code was sent to.
 *
 * Brute-force protection lives on the document:
 *  - attempts counts failed verifications and is capped by config
 *  - expiresAt TTL removes stale codes automatically
 */
import mongoose from "mongoose";
import { env } from "../config/env.js";

// "email"/"phone" are the legacy labels used by otp.service; the canonical
// spec names "email_verify"/"phone_verify" are accepted as well.
export const OTP_TYPES = [
  "email",
  "phone",
  "email_verify",
  "phone_verify",
  "password_reset",
  "login_2fa",
];

const otpSchema = new mongoose.Schema(
  {
    /** Delivery target: an email address OR an E.164 phone number. */
    target: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    type: {
      type: String,
      enum: OTP_TYPES,
      required: true,
    },
    /** Account the code belongs to (null until the issuer resolves a user). */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    codeHash: {
      type: String,
      required: true, // SHA-256 of the 6-digit code — raw code is never stored
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // TTL cleanup after expiry
    },
    used: {
      type: Boolean,
      default: false, // flips true when the code is successfully verified
    },
  },
  { timestamps: true }
);

/** Compound lookup key: exactly one active row per target+type. */
otpSchema.index({ target: 1, type: 1 }, { unique: true });

otpSchema.methods.isExpired = function () {
  return this.expiresAt <= new Date();
};

otpSchema.methods.isLocked = function () {
  return this.attempts >= env.otp.maxAttempts;
};

const Otp = mongoose.model("Otp", otpSchema);
export default Otp;

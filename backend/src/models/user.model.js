/**
 * User model.
 *
 * Security notes:
 *  - Passwords are hashed automatically in the pre("save") hook whenever
 *    the password changes. Controllers never hash manually.
 *  - select:false keeps the hash out of query results unless explicitly
 *    requested (+password); the toJSON transform is a second safety net.
 *  - refreshTokens stores SHA-256 HASHES only (never raw tokens) and
 *    supports multiple devices simultaneously.
 *  - failedLoginAttempts + lockUntil implement temporary account lockout.
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name must be at most 50 characters"],
      // Letters (any language) and spaces only — no digits/symbols.
      match: [/^[\p{L}\s]+$/u, "Name may contain letters and spaces only"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true, // normalize so duplicates can't slip through
      trim: true,
      match: [EMAIL_REGEX, "Please provide a valid email address"],
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      // Stored normalized in E.164 (e.g. "+919876543210") by libphonenumber-js
      // in the validation layer; this regex is a final sanity net.
      // NOTE: phone is validated for correct digit-count-per-country but is
      // NOT OTP-verified (email is the only verified channel).
      match: [/^\+[1-9]\d{7,14}$/, "Phone must be a valid international number (E.164)"],
    },

    /** ISO country code derived from the phone number, e.g. "IN", "US". */
    countryCode: { type: String, default: "" },

    /**
     * Hashing happens in the pre-save hook. NOT required at creation time:
     * accounts are created without a password and it is collected only
     * AFTER the email is verified (signup wizard → POST /set-password).
     */
    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters"],
      maxlength: [72, "Password must be at most 72 characters"], // bcrypt input limit
      select: false, // never fetched unless explicitly requested
      // Complexity policy (mirrored with friendly messages in Zod):
      // uppercase + lowercase + digit + special character.
      validate: {
        validator: (v) =>
          /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v),
        message:
          "Password needs an uppercase letter, a lowercase letter, a number and a special character",
      },
    },

    /* ---- Verification state ---- */
    isEmailVerified: { type: Boolean, default: false },

    /**
     * Optional second factor. When true, a successful password check does
     * NOT create a session — instead a short-lived pending token is issued
     * and a 6-digit code is emailed; POST /verify-login-otp completes it.
     */
    twoFactorEnabled: { type: Boolean, default: false },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    /* ---- Brute-force protection (account lockout) ---- */
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },

    /**
     * Active sessions — one entry per logged-in DEVICE.
     * Only the SHA-256 HASH of each refresh token is kept, plus just enough
     * context to power the "Devices & sessions" management screen:
     *   _id        → public session id used by DELETE /sessions/:id
     *   ip/device  → so the user can recognize the device
     *   rememberMe → whether this cookie lives 30 days or 7
     */
    refreshTokens: {
      type: [
        {
          tokenHash: { type: String, required: true },
          ip: { type: String, default: "unknown" },
          device: { type: String, default: "unknown" },
          rememberMe: { type: Boolean, default: false },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/**
 * Hash the password on create/update before hitting the database.
 * Promise-style hook (no `next` callback): Mongoose awaits the async
 * function and treats a rejection as a hook error.
 */
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

/* ------------------------------------------------------------------ */
/* Instance methods                                                    */
/* ------------------------------------------------------------------ */

/** Compare a plaintext candidate against the stored hash.
 * Accounts that never set a password yet simply never match. */
userSchema.methods.comparePassword = function (candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

/** Is the account currently locked out? */
userSchema.methods.isLocked = function () {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

/** Minutes until the lockout lifts (0 when not locked). */
userSchema.methods.minutesUntilUnlock = function () {
  if (!this.isLocked()) return 0;
  return Math.ceil((this.lockUntil - new Date()) / 60_000);
};

/** Record a failed login; locks the account at the configured threshold. */
userSchema.methods.registerFailedLogin = function () {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= env.lockout.maxFailedAttempts) {
    this.lockUntil = new Date(Date.now() + env.lockout.lockMinutes * 60_000);
  }
  return this.save();
};

/** Clear lockout counters after a successful login. */
userSchema.methods.resetLoginFailures = function () {
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
  return this.save();
};

/* ------------------------------------------------------------------ */
/* Refresh-token session helpers (hashes stored on the user doc)       */
/* ------------------------------------------------------------------ */

/** Max concurrent device sessions before oldest are evicted. */
const MAX_DEVICES = 10;

/**
 * Persist a new device session, evicting the oldest beyond MAX_DEVICES.
 * @param {{tokenHash:string, ip?:string, device?:string, rememberMe?:boolean}} session
 */
userSchema.methods.addSession = function ({ tokenHash, ip = "unknown", device = "unknown", rememberMe = false }) {
  this.refreshTokens.unshift({ tokenHash, ip, device, rememberMe });
  if (this.refreshTokens.length > MAX_DEVICES) {
    this.refreshTokens.length = MAX_DEVICES;
  }
  return this.save();
};

/**
 * Rotation: swap an old session hash for a new one in one atomic update.
 * Returns the matched count so callers can detect replayed tokens.
 */
userSchema.statics.rotateRefreshTokenHash = function (userId, oldHash, newHash) {
  return this.updateOne(
    { _id: userId, "refreshTokens.tokenHash": oldHash },
    { $set: { "refreshTokens.$.tokenHash": newHash } }
  );
};

/** Revoke every session (all devices) — theft response / logout-all. */
userSchema.statics.revokeAllRefreshTokens = function (userId) {
  return this.updateOne({ _id: userId }, { $set: { refreshTokens: [] } });
};

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

/** Strip sensitive/internal fields from any JSON serialization. */
userSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.refreshTokens;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model("User", userSchema);
export default User;

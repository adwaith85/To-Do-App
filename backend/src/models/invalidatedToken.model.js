/**
 * InvalidatedToken model — a server-side BLACKLIST for refresh tokens.
 *
 * When a user logs out, their refresh token hash is moved here. If that
 * same token is ever presented again (e.g. stolen from a compromised
 * client), the API answers 401 — the token is dead with no access.
 *
 * Storage: SHA-256 hashes only. Each row carries the token's own expiry so
 * a TTL index purges it right after the token would have expired anyway —
 * the blacklist never grows indefinitely.
 */
import mongoose from "mongoose";

export const INVALIDATION_REASONS = [
  "logout",
  "logout_all",
  "session_revoked", // one device killed from the sessions screen
  "admin_revoke",
];

const invalidatedTokenSchema = new mongoose.Schema(
  {
    /** SHA-256 fingerprint of the dead refresh token. */
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reason: {
      type: String,
      enum: INVALIDATION_REASONS,
      default: "logout",
    },
    /**
     * When the underlying JWT expires. TTL index removes the row after
     * this moment — keeping it longer would be pointless.
     */
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: true }
);

/**
 * Blacklist one or more token hashes in bulk.
 * @param {string} userId
 * @param {string[]} hashes - SHA-256 hashes to invalidate.
 * @param {Date} expiresAt  - expiry to stamp on every row (TTL cleanup).
 * @param {string} reason   - see INVALIDATION_REASONS.
 */
invalidatedTokenSchema.statics.invalidateMany = function (userId, hashes, expiresAt, reason = "logout") {
  if (!hashes?.length) return Promise.resolve();
  const docs = hashes.map((tokenHash) => ({
    tokenHash,
    user: userId,
    reason,
    expiresAt,
  }));
  // ordered:false → keep inserting even if a duplicate hash appears.
  return this.insertMany(docs, { ordered: false }).catch((err) => {
    // Duplicate-key errors are fine here (already blacklisted).
    if (err.code !== 11000 && err.name !== "BulkWriteError") throw err;
  });
};

const InvalidatedToken = mongoose.model("InvalidatedToken", invalidatedTokenSchema);
export default InvalidatedToken;

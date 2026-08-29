/**
 * RateLimitLog — captures who is hitting API limits and from where.
 *
 * Section D ("rate-limit hits log"): admins can spot abuse patterns —
 * which endpoint, which IP, which authenticated user (when known).
 *
 * Written by the rate-limit middleware's `handler` throwaway path; it is
 * fire-and-forget so a logging failure never blocks the 429 response.
 */
import mongoose from "mongoose";

const rateLimitLogSchema = new mongoose.Schema(
  {
    ip: { type: String, default: "unknown", index: true },
    /** Authenticated user, when the request carried a Bearer token. */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    method: { type: String, default: "" },
    path: { type: String, default: "", index: true },
    /** Which limiter tripped, e.g. "auth", "register", "api". */
    limiter: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true } // createdAt = when the limit was hit
);

rateLimitLogSchema.index({ createdAt: -1 });
// 90-day retention.
rateLimitLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const RateLimitLog = mongoose.model("RateLimitLog", rateLimitLogSchema);
export default RateLimitLog;

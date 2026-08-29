/**
 * AdminAuditLog — immutable record of every privileged ADMIN action.
 *
 * Section E of the spec: admins are themselves auditable, so anyone can
 * answer "who locked/unlocked/deleted what, and when?".
 *
 * Every entry captures:
 *   who   (adminId + role)
 *   what  (action + targetType + targetId + details)
 *   where (ip)
 *   when  (createdAt)
 */
import mongoose from "mongoose";

export const ADMIN_ACTIONS = [
  "lock_user",
  "unlock_user",
  "deactivate_user",
  "reactivate_user",
  "force_logout_user",
  "revoke_session",
  "restore_todo",
  "purge_todo",
];

const adminAuditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ADMIN_ACTIONS,
      required: true,
    },
    /** "User" | "Todo" | "Session" | "Otp" ... */
    targetType: {
      type: String,
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    /** Extra context (before/after values). Never store secrets here. */
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "unknown" },
  },
  { timestamps: true } // createdAt = when the admin action happened
);

// Fast browsing newest-first + per-admin filtering.
adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ targetType: 1, targetId: 1 });
// 1-year retention.
adminAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const AdminAuditLog = mongoose.model("AdminAuditLog", adminAuditLogSchema);
export default AdminAuditLog;

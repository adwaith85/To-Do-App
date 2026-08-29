/**
 * Admin audit utility — records privileged actions into AdminAuditLog.
 *
 * Fire-and-forget friendly: a logging failure must never break the admin's
 * request, so callers can `await` it but it always swallows errors.
 */
import AdminAuditLog from "../models/adminAuditLog.model.js";
import { getClientIp } from "./history.util.js";

/**
 * Persist one admin action.
 * @param {object} params
 * @param {string}                 params.adminId     - the acting admin's _id.
 * @param {string}                 params.action      - see ADMIN_ACTIONS.
 * @param {"User"|"Todo"|"Session"|string} params.targetType
 * @param {string}                 [params.targetId]  - subject _id (if any).
 * @param {object}                 [params.details]   - extra context (no secrets).
 * @param {import("express").Request} params.req      - for the IP address.
 */
export async function logAdminAction({
  adminId,
  action,
  targetType,
  targetId = null,
  details = {},
  req,
}) {
  try {
    await AdminAuditLog.create({
      adminId,
      action,
      targetType,
      targetId: targetId || null,
      details,
      ip: getClientIp(req),
    });
  } catch (error) {
    console.error("[admin-audit] Failed to write audit log:", error.message);
  }
}

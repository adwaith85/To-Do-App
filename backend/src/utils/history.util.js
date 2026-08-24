/**
 * Login history / audit utility.
 *
 * Writes security-relevant events (login attempts, registrations, token
 * refreshes, suspected token reuse...) into the LoginHistory collection
 * so there is a chronological trail for every account action.
 *
 * Design rules:
 *  - NEVER throws: a logging failure must not break the user's request.
 */
import LoginHistory from "../models/loginHistory.model.js";

/** Extract the best-guess client IP behind optional proxies/load balancers. */
export function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/** Compact browser/device string for the audit trail. */
export function getDevice(req) {
  return (req.headers["user-agent"] || "unknown").slice(0, 255);
}

/**
 * Persist one auth event.
 * @param {object} params
 * @param {mongoose.Types.ObjectId|null} params.userId - subject user, if known.
 * @param {string} params.action   - e.g. "LOGIN_SUCCESS" (see model enum).
 * @param {"success"|"failed"} [params.status]
 * @param {import("express").Request} params.req   - for IP / device info.
 * @param {object} [params.meta]   - extra context, kept small (no secrets).
 * @param {string} [params.location] - optional geo-IP result (future use).
 */
export async function logAuthEvent({
  userId = null,
  action,
  status = "success",
  req,
  meta = {},
  location = "",
}) {
  try {
    await LoginHistory.create({
      user: userId,
      action,
      status,
      ip: getClientIp(req),
      device: getDevice(req),
      location,
      meta,
    });
  } catch (error) {
    console.error("[history] Failed to write login history:", error.message);
  }
}

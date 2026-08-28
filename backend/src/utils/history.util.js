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
 * Best-guess identifier the visitor typed, across all auth bodies:
 *  - login normalizes into { email: { email | phone } }
 *  - register/resend/forgot send a plain email (or phone)
 * Returns "" when nothing shaped like an identifier is present.
 */
function getEnteredIdentifier(req) {
  const body = req.body || {};
  if (body.email && typeof body.email === "object") {
    return body.email.email || body.email.phone || "";
  }
  if (typeof body.email === "string") return body.email;
  if (typeof body.phone === "string") return body.phone;
  if (typeof body.identifier === "string") return body.identifier;
  return "";
}

/**
 * Persist one auth event.
 * @param {object} params
 * @param {mongoose.Types.ObjectId|null} params.userId - subject user, if known.
 * @param {string} params.action   - e.g. "LOGIN_SUCCESS" (see model enum).
 * @param {"success"|"failed"|"failed_password"|"failed_locked"|"failed_otp"} [params.status]
 * @param {import("express").Request} params.req   - for IP / device / identifier.
 * @param {object} [params.meta]   - extra context, kept small (no secrets).
 * @param {string} [params.emailOrPhone] - what was typed; auto-derived from req.body.
 * @param {string} [params.reason]       - failure context; falls back to meta.reason.
 * @param {string} [params.location]     - optional geo-IP result (future use).
 */
export async function logAuthEvent({
  userId = null,
  action,
  status = "success",
  req,
  meta = {},
  emailOrPhone,
  reason,
  location = "",
}) {
  try {
    await LoginHistory.create({
      user: userId,
      emailOrPhone:
        emailOrPhone !== undefined ? emailOrPhone : getEnteredIdentifier(req),
      action,
      status,
      reason: reason !== undefined ? reason : String(meta?.reason || ""),
      ip: getClientIp(req),
      device: getDevice(req),
      location,
      meta,
    });
  } catch (error) {
    console.error("[history] Failed to write login history:", error.message);
  }
}

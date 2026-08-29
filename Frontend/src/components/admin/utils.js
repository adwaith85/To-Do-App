/**
 * Non-component helper utilities shared across the admin console.
 * Kept out of ui.jsx so that file only exports components (fast refresh).
 */

/** Compact date formatter used across tables. */
export function fmtDate(iso, withSeconds = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
}

/** Best-effort human device label from a user-agent string. */
export function deviceLabel(ua = "") {
  const s = String(ua).toLowerCase();
  const b = s.includes("edg/") ? "Edge" : s.includes("chrome") ? "Chrome"
    : s.includes("firefox") ? "Firefox" : s.includes("safari") ? "Safari"
    : s.includes("postman") ? "API client" : "Browser";
  const os = s.includes("windows") ? "Windows" : s.includes("mac") ? "macOS"
    : s.includes("android") ? "Android" : s.includes("iphone") || s.includes("ipad") ? "iOS"
    : s.includes("linux") ? "Linux" : "";
  return [b, os].filter(Boolean).join(" · ") || "Unknown device";
}

/** Account status → badge tone mapping (green active, red locked/off, gray deactivated). */
export const STATUS_TONE = {
  active: "green",
  locked: "red",
  deactivated: "gray",
  unverified: "amber",
  pending: "amber",
};

/** Todo status → badge tone mapping. */
export const TODO_STATUS_TONE = {
  completed: "green",
  in_progress: "amber",
  pending: "cyan",
};

/** Todo priority → badge tone mapping. */
export const TODO_PRIORITY_TONE = {
  high: "red",
  medium: "amber",
  low: "green",
};
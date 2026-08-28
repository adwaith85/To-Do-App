/**
 * "Remember me" device persistence.
 *
 * When a user signs in with Remember Me ticked, we keep their identifier
 * and password in localStorage so the login form is pre-filled on that
 * device — until they uncheck it or log out (both clear it).
 *
 * NOTE: this mirrors the classic "remember password" behaviour the user
 * expects. The real session is still the httpOnly refresh cookie; the
 * stored copy is convenience-only and is wiped on logout.
 */
const KEY = "securetodo.remembered";

export function getRemembered() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data?.identifier === "string" && typeof data?.password === "string") {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function setRemembered(identifier, password) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ identifier, password }));
  } catch {
    /* storage unavailable — the session cookie still keeps them logged in */
  }
}

export function clearRemembered() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
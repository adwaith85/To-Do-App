/**
 * "Remember me" device persistence.
 *
 * When a user signs in with Remember Me ticked, we keep their identifier
 * and password in localStorage so the login form is pre-filled on that
 * device — until they uncheck it (which clears it).
 *
 * SINGLE-ACCOUNT RULE: only ONE account is ever remembered per browser.
 * The FIRST account that signs in with Remember Me owns the slot; signing
 * in with a different account does NOT overwrite it (that account's
 * remember-me data is simply not kept). This keeps the login page always
 * pre-filled with the first account's details and discards the rest.
 *
 * NOTE: the real session is still the httpOnly refresh cookie; the stored
 * copy is convenience-only for pre-filling the login form.
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
    const existing = getRemembered();
    if (existing && existing.identifier !== identifier) {
      // A different account is already remembered → keep the FIRST account,
      // delete this one's remember-me data (never overwrite).
      return;
    }
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
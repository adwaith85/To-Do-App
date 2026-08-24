/**
 * CSRF defense — double-submit cookie pattern.
 *
 * The API authenticates most requests with a Bearer header (immune to
 * CSRF), but TWO endpoints trust the httpOnly refresh cookie:
 *   POST /refresh-token  and  POST /logout.
 *
 * Pattern: the server drops a RANDOM csrfToken cookie that JavaScript CAN
 * read (not httpOnly). Every state-changing request must echo it in the
 * X-CSRF-Token header. A cross-site attacker can force cookies to be SENT,
 * but cannot READ the cookie to set the matching header — mismatch → 403.
 *
 * ensureCsrfCookie runs app-wide so the cookie exists before login;
 * requireCsrf guards only the cookie-trusting routes above.
 */
import crypto from "crypto";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

/** Give every visitor a readable CSRF token if they don't have one yet. */
export function ensureCsrfCookie(req, res, next) {
  const name = env.cookies.csrfTokenName;

  if (!req.cookies?.[name]) {
    res.cookie(name, crypto.randomBytes(24).toString("hex"), {
      httpOnly: false, // must be readable by our own JS to echo it back
      secure: env.isProd,
      sameSite: env.cookies.sameSite,
      path: "/", // readable on any page of the SPA
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
  next();
}

/** Verify header echo for endpoints that authenticate via cookie alone. */
export function requireCsrf(req, _res, next) {
  const name = env.cookies.csrfTokenName;
  const cookieToken = req.cookies?.[name];
  const headerToken = req.headers["x-csrf-token"];

  // No cookie at all → nothing to protect yet (e.g. first-ever refresh);
  // let the auth logic below decide — this layer only blocks MISMATCHES.
  if (!cookieToken) return next();

  if (!headerToken || headerToken !== cookieToken) {
    return next(ApiError.forbidden("CSRF check failed. Refresh the page and try again.", "CSRF_FAILED"));
  }
  next();
}

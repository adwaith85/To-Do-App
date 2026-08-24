/**
 * Session/token lifecycle service.
 *
 * Refresh token storage follows the spec: an ARRAY OF HASHES embedded on
 * the User document (`user.refreshTokens`) so multiple devices can hold
 * independent sessions.
 *
 * LOGOUT BLACKLISTING (explicit requirement):
 *   On logout the presented token's hash moves into the InvalidatedToken
 *   collection. If that exact token is ever replayed — by a hacker who
 *   captured it, or an old client — the API recognizes it as a logged-out
 *   token and denies access (401), even though its JWT is not yet expired.
 *   Rows are TTL-purged once the token would have expired naturally.
 *
 * Decision matrix inside rotateRefreshToken():
 *   hash ∈ blacklist            → 401 "session ended" (no side effects)
 *   hash ∉ refreshTokens        → replay/stolen → revoke ALL user sessions
 *   hash ∈ refreshTokens        → rotate: swap old↔new atomically
 */
import User from "../models/user.model.js";
import InvalidatedToken from "../models/invalidatedToken.model.js";
import { env } from "../config/env.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "../utils/jwt.util.js";
import { ApiError } from "../utils/ApiError.js";

/* ------------------------------------------------------------------ */
/* Cookie helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * httpOnly  → JavaScript can't read the token (XSS mitigation)
 * secure    → HTTPS-only in production
 * sameSite  → CSRF mitigation ("lax" blocks cross-site POSTs)
 * path      → browser only attaches it to /api/auth/* requests
 */
export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.cookies.sameSite,
    path: "/api/auth",
    maxAge: env.jwt.refreshTtlMs,
  };
}

export function setRefreshCookie(res, rawToken) {
  res.cookie(env.cookies.refreshTokenName, rawToken, refreshCookieOptions());
}

export function clearRefreshCookie(res) {
  // Must match the original options for the browser to remove it.
  res.clearCookie(env.cookies.refreshTokenName, refreshCookieOptions());
}

/** Read the raw refresh token from the incoming request cookie jar. */
export function getRefreshTokenFromRequest(req) {
  return req.cookies?.[env.cookies.refreshTokenName] || null;
}

/* ------------------------------------------------------------------ */
/* Issue                                                               */
/* ------------------------------------------------------------------ */

/**
 * Create a brand-new session for `user`:
 * access token (returned to client) + refresh token (httpOnly cookie).
 * @returns {Promise<string>} the fresh access token
 */
export async function issueSession(user, req, res) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await user.addRefreshTokenHash(hashToken(refreshToken));
  setRefreshCookie(res, refreshToken);

  return accessToken;
}

/* ------------------------------------------------------------------ */
/* Rotate                                                              */
/* ------------------------------------------------------------------ */

/**
 * Exchange a valid refresh token for a NEW pair (rotation).
 * See the decision matrix in the file header.
 *
 * @returns {{accessToken: string, user: object}}
 */
export async function rotateRefreshToken(rawToken, req, res) {
  let payload;
  try {
    payload = verifyRefreshToken(rawToken); // throws ApiError(401) on bad/expired JWT
  } catch (error) {
    // An unusable JWT should never keep a stale cookie around.
    clearRefreshCookie(res);
    throw error;
  }

  const oldHash = hashToken(rawToken);

  /* ---- 1. Explicitly logged-out token? Deny, no side effects. ---- */
  const blacklisted = await InvalidatedToken.findOne({ tokenHash: oldHash });
  if (blacklisted) {
    clearRefreshCookie(res);
    throw new ApiError(401, "This session has ended. Please log in again.", [], "SESSION_ENDED");
  }

  const user = await User.findById(payload.sub).select("+refreshTokens");
  if (!user || !Array.isArray(user.refreshTokens)) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized("Session no longer exists. Please log in again.");
  }

  /* ---- 2. Unknown token (rotated away / revoked / forged) → theft ---- */
  if (!user.refreshTokens.includes(oldHash)) {
    // Replay of an already-rotated token → assume theft: kill every session.
    const hashes = [...user.refreshTokens];
    await User.revokeAllRefreshTokens(user._id);
    // Blacklist them too so replays say "ended", not "suspicious", later.
    await blacklistWithUpperBound(user._id, hashes, "logout_all");
    clearRefreshCookie(res);
    throw new ApiError(401, "Session revoked due to suspicious activity. Please log in again.");
  }

  /* ---- 3. Verification gate ---- */
  if (!user.isEmailVerified) {
    await User.revokeAllRefreshTokens(user._id);
    clearRefreshCookie(res);
    throw ApiError.forbidden("Please verify your email first.", "EMAIL_NOT_VERIFIED");
  }

  /* ---- 4. Rotation: atomically replace old hash with the new one ---- */
  const refreshToken = signRefreshToken(user);
  const result = await User.rotateRefreshTokenHash(
    user._id,
    oldHash,
    hashToken(refreshToken)
  );

  if (result.matchedCount === 0) {
    // Lost a race against a concurrent revocation — be safe.
    clearRefreshCookie(res);
    throw ApiError.unauthorized("Session was revoked. Please log in again.");
  }

  setRefreshCookie(res, refreshToken);
  const accessToken = signAccessToken(user);

  return { accessToken, user };
}

/* ------------------------------------------------------------------ */
/* Revoke                                                              */
/* ------------------------------------------------------------------ */

/**
 * Logout for ONE device:
 *   - remove the presented token's hash from user.refreshTokens
 *   - ADD it to the permanent-ish blacklist so replays are denied forever
 *     (until its natural expiry purges the row).
 *
 * Safe/idempotent: missing or garbage cookies simply do nothing.
 * @returns {Promise<string|null>} userId whose session ended, if known.
 */
export async function revokeCurrentSession(req, res) {
  const rawToken = getRefreshTokenFromRequest(req);
  if (!rawToken) return null;

  let payload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    return null; // expired/garbage token — nothing left to invalidate
  }

  const userId = payload.sub;
  const deadHash = hashToken(rawToken);

  // Token's own expiry → when the blacklist row can be TTL-purged.
  const naturalExpiry = new Date(payload.exp * 1000);

  await Promise.all([
    User.updateOne({ _id: userId }, { $pull: { refreshTokens: deadHash } }),
    InvalidatedToken.invalidateMany(userId, [deadHash], naturalExpiry, "logout"),
  ]);

  return userId ?? null;
}

/** Revoke + blacklist EVERY session across all devices. */
export async function revokeAllSessions(userId) {
  const user = await User.findById(userId).select("+refreshTokens");
  if (!user) return;

  const hashes = [...(user.refreshTokens || [])];
  if (hashes.length > 0) {
    // We don't store per-token expiries; use the max possible remaining
    // lifetime (refresh TTL from now) as the blacklist upper bound.
    await blacklistWithUpperBound(userId, hashes, "logout_all");
  }
  await User.revokeAllRefreshTokens(userId);
}

/** Blacklist helper stamping rows with a generous TTL-safe expiry. */
function blacklistWithUpperBound(userId, hashes, reason) {
  const upperBoundExpiry = new Date(Date.now() + env.jwt.refreshTtlMs);
  return InvalidatedToken.invalidateMany(userId, hashes, upperBoundExpiry, reason);
}

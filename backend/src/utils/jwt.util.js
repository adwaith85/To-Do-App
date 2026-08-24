/**
 * JWT helpers for the access/refresh token pair.
 *
 * Access token : short-lived (~15 min), sent as Bearer token, kept in memory
 *                on the client. Verifies identity on every API call.
 * Refresh token: long-lived (~7 days), delivered in an httpOnly cookie and
 *                stored hashed in MongoDB so it can be revoked/rotated.
 */
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

/** Create a short-lived access token for a user document. */
export function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id) }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  });
}

/**
 * Create a long-lived refresh token.
 * `jti` (unique id per token) makes every refresh token distinct even when
 * issued within the same second — required for rotation tracking.
 */
export function signRefreshToken(user) {
  return jwt.sign({ sub: String(user._id), jti: crypto.randomUUID() }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });
}

/** Verify an access token or throw a 401 ApiError. */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.jwt.accessSecret);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new ApiError(401, "Access token expired", [], "TOKEN_EXPIRED");
    }
    throw new ApiError(401, "Invalid access token");
  }
}

/** Verify a refresh token or throw a 401 ApiError. */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, env.jwt.refreshSecret);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new ApiError(401, "Refresh token expired, please log in again", [], "REFRESH_EXPIRED");
    }
    throw new ApiError(401, "Invalid refresh token");
  }
}

/**
 * One-way SHA-256 fingerprint of a token.
 * We store THIS in MongoDB instead of the raw token, so a database leak
 * alone can't be used to mint valid sessions.
 */
export function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

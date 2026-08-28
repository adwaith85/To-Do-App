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
 *
 * @param {object} user
 * @param {{rememberMe?: boolean}} [options]
 *   rememberMe=true stretches the lifetime to the 30-day policy; the
 *   default session lives 7 days.
 * `jti` (unique id per token) makes every refresh token distinct even when
 * issued within the same second — required for rotation tracking.
 */
export function signRefreshToken(user, { rememberMe = false } = {}) {
  return jwt.sign(
    { sub: String(user._id), jti: crypto.randomUUID(), rem: rememberMe },
    env.jwt.refreshSecret,
    { expiresIn: rememberMe ? env.jwt.refreshRememberExpiresIn : env.jwt.refreshExpiresIn }
  );
}

/**
 * Short-lived "2FA pending" proof. Issued after the PASSWORD step of a
 * login when twoFactorEnabled is on; carries no session power — it only
 * lets /verify-login-otp identify WHO is trying to finish signing in.
 */
export function signTwoFactorPendingToken(user) {
  return jwt.sign(
    { sub: String(user._id), purpose: "2fa" },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.twoFactorExpiresIn }
  );
}

/** Verify a 2FA pending token or throw a 401 ApiError. */
export function verifyTwoFactorPendingToken(token) {
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret);
    if (payload.purpose !== "2fa") throw new Error("wrong purpose");
    return payload;
  } catch {
    throw ApiError.unauthorized("Login session expired. Please sign in again.", "TWO_FACTOR_EXPIRED");
  }
}

/**
 * Short-lived "email verified" proof used by the signup wizard. Issued by
 * /verify-otp for accounts WITHOUT a password yet; authorizes the very next
 * step (POST /set-password) to create the password. Grants nothing else.
 */
export function signSignupToken(user) {
  return jwt.sign(
    { sub: String(user._id), purpose: "signup" },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.twoFactorExpiresIn }
  );
}

/** Verify a signup token or throw a 400 ApiError. */
export function verifySignupToken(token) {
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret);
    if (payload.purpose !== "signup") throw new Error("wrong purpose");
    return payload;
  } catch {
    throw ApiError.badRequest(
      "This verification has expired. Please register again.",
      [],
      "SIGNUP_TOKEN_EXPIRED"
    );
  }
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

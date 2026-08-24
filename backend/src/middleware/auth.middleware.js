/**
 * requireAuth — protects any route that needs a logged-in user.
 *
 * Expects:  Authorization: Bearer <accessToken>
 * Effect:   req.user is populated with the verified user document
 *           (password excluded via select), or a 401 ApiError is thrown.
 *
 * The frontend's axios interceptor automatically calls /refresh-token and
 * retries when it receives 401 + code "TOKEN_EXPIRED".
 */
import User from "../models/user.model.js";
import { verifyAccessToken } from "../utils/jwt.util.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Authentication required. Please log in.");
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyAccessToken(token); // throws 401 ApiError if bad/expired

  // Re-check the DB so revoked/deleted users lose access immediately,
  // even while their short-lived access token is technically valid.
  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized("User no longer exists.");
  }

  req.user = user;
  next();
});

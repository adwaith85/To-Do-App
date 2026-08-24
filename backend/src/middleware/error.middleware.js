/**
 * Centralized error handling — the last two middlewares in the chain.
 *
 * notFound    : catches requests to unknown routes (404).
 * errorHandler: converts ANY thrown error into a safe JSON response.
 *               - ApiError            → its own status/message/code
 *               - Mongoose errors     → mapped to friendly 400/409
 *               - JWT errors          → 401
 *               - anything else       → 500 with details hidden in production
 */
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

/** 404 for unmatched routes. Must be registered AFTER all real routes. */
export function notFoundHandler(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

/* eslint-disable no-unused-vars -- Express identifies error handlers by arity */
export function errorHandler(err, req, res, _next) {
  // Default: unexpected failure.
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = err.errors || [];
  let code = err.code; // machine-readable code (may be undefined)

  /* ---- Map well-known infrastructure/driver errors ---- */

  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for "${err.path}"`;
  }

  if (err.code === 11000) {
    // Mongo duplicate key → e.g. registering an existing email twice.
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `That ${field} is already in use`;
  }

  if (err.name === "ValidationError") {
    // Mongoose schema validation (defense-in-depth behind Zod).
    statusCode = 400;
    errors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    message = errors[0]?.message || "Validation failed";
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  /* ---- Respond ---- */

  // Unexpected (non-operational) errors get logged for debugging.
  if (!err.isOperational && statusCode >= 500) {
    console.error("[error] Unhandled:", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors.length > 0 && { errors }),
    ...(code && { code }),
    ...(env.isProd ? {} : { stack: err.stack?.split("\n") }), // dev-only stack trace
  });
}

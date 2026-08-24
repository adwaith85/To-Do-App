/**
 * Application error class used across controllers and services.
 *
 * Throwing an ApiError anywhere inside a request lets the global error
 * handler respond with the right status code and a clean JSON body,
 * instead of leaking stack traces.
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code to send.
   * @param {string} message   - Human readable error message.
   * @param {Array}  [errors]  - Optional list of field-level issues
   *                              e.g. [{ field: "email", message: "..." }]
   * @param {string} [code]    - Machine readable code the frontend can branch on
   *                              e.g. "EMAIL_NOT_VERIFIED".
   */
  constructor(statusCode, message, errors = [], code = undefined) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    this.isOperational = true; // marks expected errors (vs. programming bugs)

    Error.captureStackTrace?.(this, this.constructor);
  }

  /* Convenience factories for the most common cases */
  static badRequest(message, errors = [], code = undefined) {
    return new ApiError(400, message, errors, code);
  }
  static unauthorized(message = "Not authenticated", code = undefined) {
    return new ApiError(401, message, [], code);
  }
  static forbidden(message = "Forbidden", code = undefined) {
    return new ApiError(403, message, [], code);
  }
  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }
  static conflict(message) {
    return new ApiError(409, message);
  }
  static tooManyRequests(message = "Too many requests, please slow down") {
    return new ApiError(429, message);
  }
}

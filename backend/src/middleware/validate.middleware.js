/**
 * Generic Zod validation middleware.
 *
 * Usage:  router.post("/login", validate({ body: loginSchema }), handler)
 *
 * Behavior:
 *  - Validates req.body / req.params / req.query against the given schemas.
 *  - On success, REPLACES each part with the parsed value — Zod strips
 *    unknown keys and applies transforms (.trim(), .toLowerCase(), ...),
 *    so handlers always receive clean data.
 *  - On failure, throws ApiError(400) with per-field messages that the
 *    global error handler serializes to JSON.
 */
import { ApiError } from "../utils/ApiError.js";

export function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = parsePart(schemas.body, req.body ?? {}, "body");
      if (schemas.params) req.params = parsePart(schemas.params, req.params ?? {}, "params");
      if (schemas.query) req.validatedQuery = parsePart(schemas.query, req.query ?? {}, "query");
      next();
    } catch (error) {
      next(error);
    }
  };
}

function parsePart(schema, value, label) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const errors = result.error.issues.map((issue) => ({
    // "body.email", "body.password" ... so the client knows exactly what failed.
    field: `${label}${issue.path.length ? "." + issue.path.join(".") : ""}`,
    message: issue.message,
  }));

  throw new ApiError(400, errors[0]?.message || "Invalid request data", errors);
}

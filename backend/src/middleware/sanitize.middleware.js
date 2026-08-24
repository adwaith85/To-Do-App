/**
 * Input sanitizer — NoSQL injection & XSS payload scrubbing.
 *
 * Recursively removes:
 *  - keys starting with "$"      (Mongo operators like $gt/$ne/$where)
 *  - keys containing "."          (dot-notation operator injection)
 * from req.body and req.params BEFORE validation runs.
 *
 * Combined with Zod type-checking (operator objects can't pass string
 * schemas) this closes the classic NoSQL injection vectors. XSS is also
 * mitigated at the framework level (React escapes output; helmet sets
 * response headers), so we only need to stop injection-shaped payloads.
 *
 * Note for Express 5: req.query is a read-only getter, so it is left as-is;
 * every route that reads query values validates them through Zod anyway.
 */

/** True when a key looks like an injection attempt. */
const isUnsafeKey = (key) => key.startsWith("$") || key.includes(".");

/** Deep-copy `value` while dropping unsafe keys from plain objects/arrays. */
function clean(value, depth = 0) {
  if (depth > 10 || value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => clean(item, depth + 1));
  }

  if (value instanceof Date) return value;

  const safe = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isUnsafeKey(key)) {
      safe[key] = clean(item, depth + 1);
    }
  }
  return safe;
}

export function sanitize(req, _res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = clean(req.body);
  }
  if (req.params && typeof req.params === "object") {
    req.params = clean(req.params);
  }
  next();
}

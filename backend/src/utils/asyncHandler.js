/**
 * Wraps async route handlers so rejected promises reach the global error
 * handler instead of crashing the process or hanging the request.
 *
 * Without this, Express 4/5 does not catch `async` throwaways automatically
 * in every pattern — this keeps controllers free of try/catch noise.
 *
 * Usage:  router.get("/", asyncHandler(myAsyncController))
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

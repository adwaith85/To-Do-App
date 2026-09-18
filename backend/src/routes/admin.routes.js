/**
 * Admin routes → mounted at /api/admin.
 *
 * EVERY route is gated by requireAuth + authorize("admin") via router.use,
 * so only sessions whose access-token role claim is "admin" get through —
 * a DB admin who signed in as a normal user (captcha) is NOT admitted, and
 * regular users hit 403 FORBIDDEN_ROLE.
 */
import { Router } from "express";
import { validate } from "../middleware/validate.middleware.js";
import { requireAuth, authorize } from "../middleware/auth.middleware.js";
import { mongoIdParamSchema, sessionIdParamSchema } from "../validations/index.js";
import {
  adminUsersQuery,
  adminLoginHistoryQuery,
  adminLoginFailuresQuery,
  adminSessionsQuery,
  adminTodosQuery,
  adminTodoStatsQuery,
  adminDeletedTodosQuery,
  adminSignupsQuery,
  adminOtpUsageQuery,
  adminLoginTrendQuery,
  adminRateLimitsQuery,
  adminAuditQuery,
  adminMessagesQuery,
  updateMessageSchema,
  replyMessageSchema,
} from "../validations/index.js";
import {
  listUsers,
  getUserDetail,
  lockUser,
  unlockUser,
  deactivateUser,
  reactivateUser,
  forceLogoutUser,
  revokeUserSession,
  listUserSessions,
  listLoginHistory,
  listLoginFailures,
  listActiveSessions,
  authActivitySummary,
  listAllTodos,
  todoStats,
  listDeletedTodos,
  restoreTodo,
  purgeTodo,
  statsOverview,
  statsSignups,
  statsOtpUsage,
  statsLoginTrend,
  statsRateLimits,
  listAuditLog,
  listMessages,
  getMessage,
  updateMessage,
  replyMessage,
  deleteMessage,
} from "../controllers/admin.controller.js";

const router = Router();

// Gate: admins only, on every admin route.
router.use(requireAuth, authorize("admin"));

/* ---- Section A: user management ---- */
router.get("/users", validate({ query: adminUsersQuery }), listUsers);
router.get("/users/:id", validate({ params: mongoIdParamSchema }), getUserDetail);
router.patch("/users/:id/lock", validate({ params: mongoIdParamSchema }), lockUser);
router.patch("/users/:id/unlock", validate({ params: mongoIdParamSchema }), unlockUser);
router.patch("/users/:id/deactivate", validate({ params: mongoIdParamSchema }), deactivateUser);
router.patch("/users/:id/reactivate", validate({ params: mongoIdParamSchema }), reactivateUser);
router.delete("/users/:id/sessions", validate({ params: mongoIdParamSchema }), forceLogoutUser);
router.get("/users/:id/sessions", validate({ params: mongoIdParamSchema }), listUserSessions);
router.delete("/users/:id/sessions/:sessionId", validate({ params: sessionIdParamSchema }), revokeUserSession);

/* ---- Section B: login & security ---- */
router.get("/login-history", validate({ query: adminLoginHistoryQuery }), listLoginHistory);
router.get("/login-history/failed", validate({ query: adminLoginFailuresQuery }), listLoginFailures);
router.get("/security/summary", authActivitySummary);
router.get("/sessions/active", validate({ query: adminSessionsQuery }), listActiveSessions);

/* ---- Section C: todo activity ---- */
router.get("/todos", validate({ query: adminTodosQuery }), listAllTodos);
router.get("/todos/stats", validate({ query: adminTodoStatsQuery }), todoStats);
router.get("/todos/deleted", validate({ query: adminDeletedTodosQuery }), listDeletedTodos);
router.patch("/todos/:id/restore", validate({ params: mongoIdParamSchema }), restoreTodo);
router.delete("/todos/:id/purge", validate({ params: mongoIdParamSchema }), purgeTodo);

/* ---- Section D: stats / health ---- */
router.get("/stats/overview", statsOverview);
router.get("/stats/signups", validate({ query: adminSignupsQuery }), statsSignups);
router.get("/stats/otp-usage", validate({ query: adminOtpUsageQuery }), statsOtpUsage);
router.get("/stats/login-trend", validate({ query: adminLoginTrendQuery }), statsLoginTrend);
router.get("/stats/rate-limits", validate({ query: adminRateLimitsQuery }), statsRateLimits);

/* ---- Section E: audit log ---- */
router.get("/audit-log", validate({ query: adminAuditQuery }), listAuditLog);

/* ---- Section F: contact / support messages ---- */
router.get("/messages",        validate({ query: adminMessagesQuery }), listMessages);
router.get("/messages/:id",    validate({ params: mongoIdParamSchema }), getMessage);
router.patch("/messages/:id",  validate({ params: mongoIdParamSchema, body: updateMessageSchema }), updateMessage);
router.post("/messages/:id/reply", validate({ params: mongoIdParamSchema, body: replyMessageSchema }), replyMessage);
router.delete("/messages/:id", validate({ params: mongoIdParamSchema }), deleteMessage);

export default router;

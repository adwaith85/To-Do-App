/**
 * Admin controller — privileged monitoring + management endpoints.
 *
 * Every route here is REACHED ONLY through requireAuth + authorize("admin")
 * (see admin.routes.js), so `req.user` is always an admin whose session
 * role claim is "admin". Every mutating action is also written to the
 * AdminAuditLog so admins are themselves traceable.
 *
 * Sections covered (spec §5):
 *   A. User management        → /users...
 *   B. Login & security       → /login-history, /sessions...
 *   C. Todo activity          → /todos..., /todos/stats, /todos/deleted
 *   D. System / service health→ /stats/overview, /stats/signups, /stats/otp-usage, /stats/rate-limits, /health
 *   E. Admin audit log        → /audit-log
 */
import Todo from "../models/todo.model.js";
import User from "../models/user.model.js";
import Otp from "../models/otp.model.js";
import LoginHistory from "../models/loginHistory.model.js";
import RateLimitLog from "../models/rateLimitLog.model.js";
import AdminAuditLog from "../models/adminAuditLog.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { getClientIp, getDevice } from "../utils/history.util.js";
import { logAdminAction } from "../utils/adminAudit.util.js";
import { env } from "../config/env.js";

/**
 * Legacy RBAC demo (mounted at /api/auth/admin/ping). Returns the current
 * admin's session identity — kept for backward compatibility.
 */
export const adminPing = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome, admin.",
    data: { role: req.sessionRole || req.user?.role, userId: String(req.user?._id) },
  });
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Resolve a user by :id, 404 when missing. */
async function findUserOr404(id) {
  const user = await User.findById(id).select("+adminCode +refreshTokens");
  if (!user) throw ApiError.notFound("User not found.");
  return user;
}

/** Account status label for admin UIs. (works on lean docs too) */
function accountStatus(user) {
  if (user.isDeleted) return "deactivated";
  if (isLocked(user)) return "locked";
  if (!user.isActive || !user.isEmailVerified) return "unverified";
  return "active";
}

/** isLocked without relying on the mongoose instance method. */
function isLocked(user) {
  return Boolean(user.lockUntil && new Date(user.lockUntil) > new Date());
}

/** Compact admin-facing user row (includes lockout/verification info). */
function adminUserView(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    countryCode: user.countryCode || "",
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isPhoneVerified: user.isPhoneVerified,
    isActive: user.isActive,
    isDeleted: user.isDeleted,
    twoFactorEnabled: user.twoFactorEnabled,
    failedLoginAttempts: user.failedLoginAttempts,
    lockUntil: user.lockUntil,
    locked: isLocked(user),
    status: accountStatus(user),
    hasAdminCode: Boolean(user.adminCode),
    adminCodeSetAt: user.adminCodeSetAt,
    lastLoginAt: user.lastLoginAt,
    lastLoginIp: user.lastLoginIp,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    activeSessions: Array.isArray(user.refreshTokens) ? user.refreshTokens.length : 0,
  };
}

/** Clean a query value into an optional list of comma/space sep tokens. */
function toList(value) {
  if (!value) return [];
  return String(value)
    .split(/[,\s]+/)
    .filter(Boolean);
}

/** "from"/"to" date query params → {gte?, lte?} for Mongo. */
function dateRange(req) {
  const range = {};
  if (req.validatedQuery?.from) range.$gte = new Date(req.validatedQuery.from);
  if (req.validatedQuery?.to) range.$lte = new Date(req.validatedQuery.to);
  return range;
}

/* ------------------------------------------------------------------ */
/* Section A — User management                                         */
/* ------------------------------------------------------------------ */

/** GET /api/admin/users — list + filter/search users. */
export const listUsers = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || {};
  const { search, role, status, page = 1, limit = 20 } = q;
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const size = Math.min(100, parseInt(limit, 10));

  const filter = {};

  // Free-text search across name / email / phone.
  if (search) {
    const re = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { email: re }, { phone: re }];
  }

  if (role && ["user", "admin"].includes(role)) filter.role = role;

  if (status) {
    if (status === "deactivated") filter.isDeleted = true;
    else if (status === "locked") filter.lockUntil = { $gt: new Date() };
    else if (status === "active") {
      filter.isDeleted = false;
      filter.isActive = true;
      filter.isEmailVerified = true;
    } else if (status === "unverified") {
      filter.isDeleted = false;
      filter.$or = [{ isEmailVerified: false }, { isActive: false }];
    }
  }

  const [total, rows] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select("+adminCode +refreshTokens")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      users: rows.map(adminUserView),
      total,
      page: Math.max(1, parseInt(page, 10)),
      limit: size,
    },
  });
});

/** GET /api/admin/users/:id — single user detail + activity timeline. */
export const getUserDetail = asyncHandler(async (req, res) => {
  const user = await findUserOr404(req.params.id);

  // Activity timeline: recent login/security events + todo history.
  const [history, todoCounts] = await Promise.all([
    LoginHistory.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Todo.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$isDeleted", false] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          deleted: { $sum: { $cond: [{ $eq: ["$isDeleted", true] }, 1, 0] } },
        },
      },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      user: adminUserView(user),
      activity: history,
      todos: todoCounts[0] || { total: 0, active: 0, completed: 0, deleted: 0 },
    },
  });
});

/** PATCH /api/admin/users/:id/lock — manually apply a lockout. */
export const lockUser = asyncHandler(async (req, res) => {
  const user = await findUserOr404(req.params.id);
  user.lockUntil = new Date(Date.now() + env.lockout.lockMinutes * 60_000);
  await user.save();

  // Revoke all sessions so the lock is immediate everywhere.
  await User.revokeAllRefreshTokens(user._id);

  await logAdminAction({
    adminId: req.user._id, action: "lock_user", targetType: "User",
    targetId: user._id, details: { lockMinutes: env.lockout.lockMinutes }, req,
  });

  res.status(200).json({ success: true, message: "Account locked.", data: { user: adminUserView(user) } });
});

/** PATCH /api/admin/users/:id/unlock — clear an active lockout. */
export const unlockUser = asyncHandler(async (req, res) => {
  const user = await findUserOr404(req.params.id);
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  await logAdminAction({
    adminId: req.user._id, action: "unlock_user", targetType: "User",
    targetId: user._id, details: {}, req,
  });

  res.status(200).json({ success: true, message: "Account unlocked.", data: { user: adminUserView(user) } });
});

/** PATCH /api/admin/users/:id/deactivate — soft-delete + revoke sessions. */
export const deactivateUser = asyncHandler(async (req, res) => {
  const user = await findUserOr404(req.params.id);
  user.isDeleted = true;
  user.deactivatedAt = new Date();
  await user.save();
  await User.revokeAllRefreshTokens(user._id);

  await logAdminAction({
    adminId: req.user._id, action: "deactivate_user", targetType: "User",
    targetId: user._id, details: {}, req,
  });

  res.status(200).json({ success: true, message: "Account deactivated.", data: { user: adminUserView(user) } });
});

/** PATCH /api/admin/users/:id/reactivate — restore a soft-deleted account. */
export const reactivateUser = asyncHandler(async (req, res) => {
  const user = await findUserOr404(req.params.id);
  user.isDeleted = false;
  user.deactivatedAt = null;
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  await logAdminAction({
    adminId: req.user._id, action: "reactivate_user", targetType: "User",
    targetId: user._id, details: {}, req,
  });

  res.status(200).json({ success: true, message: "Account reactivated.", data: { user: adminUserView(user) } });
});

/** DELETE /api/admin/users/:id/sessions — force logout (revoke everything). */
export const forceLogoutUser = asyncHandler(async (req, res) => {
  const user = await findUserOr404(req.params.id);
  await User.revokeAllRefreshTokens(user._id);

  await logAdminAction({
    adminId: req.user._id, action: "force_logout_user", targetType: "User",
    targetId: user._id, details: {}, req,
  });

  res.status(200).json({ success: true, message: "User signed out from all devices." });
});

/** GET /api/admin/users/:id/sessions — active sessions for a user. */
export const listUserSessions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("+refreshTokens");
  if (!user) throw ApiError.notFound("User not found.");

  const sessions = (user.refreshTokens || []).map((s) => ({
    id: String(s._id),
    ip: s.ip,
    device: s.device,
    location: s.location || "",
    rememberMe: s.rememberMe,
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
  }));

  res.status(200).json({ success: true, data: { sessions } });
});

/* ------------------------------------------------------------------ */
/* Section B — Login & security monitoring                             */
/* ------------------------------------------------------------------ */

/** GET /api/admin/login-history — filterable full login history table. */
export const listLoginHistory = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || {};
  const { status, userId, page = 1, limit = 25 } = q;
  const filter = {};

  if (status) filter.status = status;
  if (userId) filter.user = userId;
  const range = dateRange(req);
  if (Object.keys(range).length) filter.createdAt = range;

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const size = Math.min(200, parseInt(limit, 10));

  const [total, rows] = await Promise.all([
    LoginHistory.countDocuments(filter),
    LoginHistory.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    data: { events: rows, total, page: Math.max(1, parseInt(page, 10)), limit: size },
  });
});

/** GET /api/admin/login-history/failed — failures grouped by IP & user. */
export const listLoginFailures = asyncHandler(async (req, res) => {
  const range = dateRange(req);
  const match = {
    $or: [{ status: "failed" }, { status: "failed_password" }, { status: "failed_locked" }],
  };
  if (Object.keys(range).length) match.createdAt = range;

  const byIp = await LoginHistory.aggregate([
    { $match: match },
    { $group: { _id: "$ip", count: { $sum: 1 }, lastAt: { $max: "$createdAt" } } },
    { $sort: { count: -1 } },
    { $limit: 30 },
  ]);

  const byUser = await LoginHistory.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$user",
        count: { $sum: 1 },
        lastAt: { $max: "$createdAt" },
        ips: { $addToSet: "$ip" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 30 },
  ]);

  // Attach user emails for the by-user view.
  const userIds = byUser.map((u) => u._id).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } })
    .select("name email")
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const usersResolved = byUser.map((u) => ({
    user: userMap.get(String(u._id)) || null,
    count: u.count,
    lastAt: u.lastAt,
    ips: u.ips,
  }));

  res.status(200).json({ success: true, data: { byIp, byUser: usersResolved } });
});

/** GET /api/admin/sessions/active — every active session across all users. */
export const listActiveSessions = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || {};
  const { page = 1, limit = 50 } = q;
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const size = Math.min(200, parseInt(limit, 10));

  const [totalUsers, rows] = await Promise.all([
    User.countDocuments({
      deleted: false,
      $expr: { $gt: [{ $size: { $ifNull: ["$refreshTokens", []] } }, 0] },
    }),
    User.find({
      $expr: { $gt: [{ $size: { $ifNull: ["$refreshTokens", []] } }, 0] },
    })
      .select("name email phone refreshTokens")
      .skip(skip)
      .limit(size)
      .lean(),
  ]);

  const sessions = [];
  for (const u of rows) {
    for (const s of u.refreshTokens || []) {
      sessions.push({
        userId: u._id,
        name: u.name,
        email: u.email,
        sessionId: String(s._id),
        ip: s.ip,
        device: s.device,
        location: s.location || "",
        rememberMe: s.rememberMe,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
      });
    }
  }
  // Ugly but fine for admin scale; sort newest last active first.
  sessions.sort((a, b) => new Date(b.lastUsedAt) - new Date(a.lastUsedAt));

  res.status(200).json({
    success: true,
    data: { sessions, total, page: Math.max(1, parseInt(page, 10)), limit: size },
  });
});

/* ------------------------------------------------------------------ */
/* Section C — Todo activity monitoring                                */
/* ------------------------------------------------------------------ */

/** GET /api/admin/todos — all todos across all users, filterable. */
export const listAllTodos = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || {};
  const { userId, status, priority, search, page = 1, limit = 25, includeDeleted } = q;
  const filter = {};

  if (userId) filter.user = userId;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (search) {
    const re = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ task: re }, { title: re }, { description: re }];
  }
  // Skip soft-deleted rows unless explicitly asked (default).
  if (!includeDeleted) filter.isDeleted = false;
  else if (includeDeleted === "true") filter.isDeleted = true;

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const size = Math.min(200, parseInt(limit, 10));

  const [total, rows] = await Promise.all([
    Todo.countDocuments(filter),
    Todo.find(filter)
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    data: { todos: rows, total, page: Math.max(1, parseInt(page, 10)), limit: size },
  });
});

/** GET /api/admin/todos/stats — counts by status/priority + totals. */
export const todoStats = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || {};
  const match = {};
  if (q.userId) match.user = q.userId;

  const [byStatus, byPriority, totals, perUser] = await Promise.all([
    Todo.aggregate([
      { $match: { ...match, isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Todo.aggregate([
      { $match: { ...match, isDeleted: false } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
    Todo.aggregate([
      { $match: { ...match, isDeleted: false } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          in_progress: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        },
      },
    ]),
    Todo.aggregate([
      { $match: { ...match, isDeleted: false } },
      {
        $group: {
          _id: "$user",
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),
  ]);

  // Resolve user names for the "most active users" table.
  const userIds = perUser.map((u) => u._id).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } })
    .select("name email")
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const activeUsers = perUser.map((u) => ({
    user: userMap.get(String(u._id)) || null,
    total: u.total,
    completed: u.completed,
  }));

  res.status(200).json({
    success: true,
    data: {
      totals: totals[0] || { total: 0, completed: 0, in_progress: 0, pending: 0 },
      byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
      byPriority: Object.fromEntries(byPriority.map((p) => [p._id, p.count])),
      mostActiveUsers: activeUsers,
    },
  });
});

/** GET /api/admin/todos/deleted — soft-deleted todos (recycle bin). */
export const listDeletedTodos = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || {};
  const { page = 1, limit = 25 } = q;
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const size = Math.min(200, parseInt(limit, 10));

  const [total, rows] = await Promise.all([
    Todo.countDocuments({ isDeleted: true }),
    Todo.find({ isDeleted: true })
      .populate("user", "name email phone")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(size)
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    data: { todos: rows, total, page: Math.max(1, parseInt(page, 10)), limit: size },
  });
});

/** PATCH /api/admin/todos/:id/restore — bring a soft-deleted todo back. */
export const restoreTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOneAndUpdate(
    { _id: req.params.id, isDeleted: true },
    { $set: { isDeleted: false } },
    { new: true }
  );
  if (!todo) throw ApiError.notFound("Deleted todo not found.");

  await logAdminAction({
    adminId: req.user._id, action: "restore_todo", targetType: "Todo",
    targetId: todo._id, details: {}, req,
  });

  res.status(200).json({ success: true, message: "Todo restored.", data: todo });
});

/** DELETE /api/admin/todos/:id/purge — permanently delete a todo. */
export const purgeTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findById(req.params.id);
  if (!todo) throw ApiError.notFound("Todo not found.");

  await Todo.deleteOne({ _id: todo._id });

  await logAdminAction({
    adminId: req.user._id, action: "purge_todo", targetType: "Todo",
    targetId: todo._id, details: { task: (todo.task || "").slice(0, 80) }, req,
  });

  res.status(200).json({ success: true, message: "Todo permanently deleted." });
});

/* ------------------------------------------------------------------ */
/* Section D — System / service health                                 */
/* ------------------------------------------------------------------ */

/** GET /api/admin/stats/overview — dashboard summary numbers. */
export const statsOverview = asyncHandler(async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [users, verified, unverified, admins, locked, deleted, todos, otpDays, loginDays] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isEmailVerified: true }),
      User.countDocuments({ isEmailVerified: false }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ lockUntil: { $gt: new Date() } }),
      User.countDocuments({ isDeleted: true }),
      Todo.countDocuments({ isDeleted: false }),
      Otp.countDocuments({ createdAt: { $gte: today } }),
      LoginHistory.countDocuments({ createdAt: { $gte: today } }),
    ]);

  res.status(200).json({
    success: true,
    data: {
      users: { total: users, verified, unverified, admins, locked, deactivated: deleted },
      todos,
      todays: { otpRequests: otpDays, loginEvents: loginDays },
      uptime: process.uptime(),
      dbConnected: true,
    },
  });
});

/** GET /api/admin/stats/signups — new registrations over time. */
export const statsSignups = asyncHandler(async (req, res) => {
  // Required: from / to dates; optional granularity day|week|month.
  const q = req.validatedQuery || {};
  const from = new Date(q.from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
  const to = new Date(q.to || Date.now());
  const gran = q.granularity === "week" ? "week" : q.granularity === "month" ? "month" : "day";

  const dateKeys = { day: "%Y-%m-%d", week: "%Y-W%U", month: "%Y-%m" };
  const data = await User.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateToString: { format: dateKeys[gran], date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json({
    success: true,
    data: { granularity: gran, points: data.map((d) => ({ bucket: d._id, count: d.count })) },
  });
});

/** GET /api/admin/stats/otp-usage — OTP sent vs verified vs failed. */
export const statsOtpUsage = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || {};
  const range = dateRange(req);
  const match = range.createdAt ? { createdAt: range.createdAt } : {};

  const [byType, byStatus, issued, total] = await Promise.all([
    Otp.aggregate([
      { $match },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Otp.aggregate([{ $match }, { $group: { _id: "$used", count: { $sum: 1 } } }]),
    Otp.countDocuments(match),
    Otp.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      total,
      issued,
      byType: Object.fromEntries(byType.map((t) => [t._id, t.count])),
      verified: byStatus.find((s) => s._id === true)?.count || 0,
      unverified: byStatus.find((s) => s._id === false)?.count || 0,
    },
  });
});

/** GET /api/admin/stats/rate-limits — rate-limit hit log. */
export const statsRateLimits = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || {};
  const { page = 1, limit = 25, limiter, ip } = q;
  const filter = {};
  if (limiter) filter.limiter = limiter;
  if (ip) filter.ip = ip;
  const range = dateRange(req);
  if (Object.keys(range).length) filter.createdAt = range;

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const size = Math.min(200, parseInt(limit, 10));

  const [total, rows] = await Promise.all([
    RateLimitLog.countDocuments(filter),
    RateLimitLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size).lean(),
  ]);

  const byLimiter = await RateLimitLog.aggregate([
    { $group: { _id: "$limiter", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      hits: rows,
      byLimiter: Object.fromEntries(byLimiter.map((l) => [l._id, l.count])),
      total,
      page: Math.max(1, parseInt(page, 10)),
      limit: size,
    },
  });
});

/* ------------------------------------------------------------------ */
/* Section E — Admin audit log                                         */
/* ------------------------------------------------------------------ */

/** GET /api/admin/audit-log — every admin action, newest first. */
export const listAuditLog = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || {};
  const { adminId, action, page = 1, limit = 25 } = q;
  const filter = {};
  if (adminId) filter.adminId = adminId;
  if (action) filter.action = action;
  const range = dateRange(req);
  if (Object.keys(range).length) filter.createdAt = range;

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const size = Math.min(200, parseInt(limit, 10));

  const [total, rows] = await Promise.all([
    AdminAuditLog.countDocuments(filter),
    AdminAuditLog.find(filter)
      .populate("adminId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    data: { events: rows, total, page: Math.max(1, parseInt(page, 10)), limit: size },
  });
});

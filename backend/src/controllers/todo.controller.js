import Todo from "../models/todo.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_HISTORY = 200;

/** Append an entry to a todo's change history, capping the log size. */
function recordHistory(todo, action, detail = "") {
  todo.history = todo.history || [];
  todo.history.push({ action, at: new Date(), detail });
  if (todo.history.length > MAX_HISTORY) {
    todo.history = todo.history.slice(-MAX_HISTORY);
  }
}

export const getTodos = asyncHandler(async (req, res) => {
  const todos = await Todo.find({ user: req.user._id, isDeleted: false, isArchived: false })
    .sort({ isPinned: -1, order: 1, createdAt: -1 })
    .maxTimeMS(10_000);
  res.status(200).json({ success: true, data: todos });
});

export const getArchivedTodos = asyncHandler(async (req, res) => {
  const todos = await Todo.find({ user: req.user._id, isDeleted: false, isArchived: true })
    .sort({ updatedAt: -1, createdAt: -1 })
    .maxTimeMS(10_000);
  res.status(200).json({ success: true, data: todos });
});

export const getReminders = asyncHandler(async (req, res) => {
  const todos = await Todo.find({
    user: req.user._id,
    isDeleted: false,
    isArchived: false,
    reminderAt: { $ne: null },
  })
    .sort({ reminderAt: 1 })
    .maxTimeMS(10_000);
  res.status(200).json({ success: true, data: todos });
});

export const addReminderValidation = (reminderAt) => {
  if (reminderAt && new Date(reminderAt).getTime() <= Date.now()) {
    throw ApiError.badRequest("Reminder time must be in the future.");
  }
};

export const createTodo = asyncHandler(async (req, res) => {
  const { task, description, priority, dueDate, tags, isPinned, reminderAt, backgroundColor } = req.body;

  addReminderValidation(reminderAt);

  const attachments = (req.files || []).map((f) => ({
    url: `/uploads/${f.filename}`,
    filename: f.originalname,
    mimetype: f.mimetype,
    size: f.size,
  }));

  const todo = await Todo.create({
    task,
    description: description || "",
    priority: priority || "medium",
    dueDate: dueDate || null,
    tags: tags || [],
    isPinned: Boolean(isPinned),
    reminderAt: reminderAt || null,
    backgroundColor: backgroundColor || "",
    attachments,
    history: [{ action: "created", at: new Date(), detail: "Todo created" }],
    user: req.user._id,
  });

  res.status(201).json({ success: true, message: "Task added.", data: todo });
});

export const updateTodo = asyncHandler(async (req, res) => {
  const { task, description, priority, dueDate, tags, isPinned, reminderAt, status, backgroundColor } = req.body;

  const todo = await Todo.findOne({
    _id: req.params.id,
    user: req.user._id,
    isDeleted: false,
  });

  if (!todo) throw ApiError.notFound("Todo not found.");

  const changed = [];
  const wasPinned = todo.isPinned;
  const wasStatus = todo.status;

  const timeEqual = (a, b) => {
    const ta = a ? new Date(a).getTime() : null;
    const tb = b ? new Date(b).getTime() : null;
    return ta === tb;
  };

  if (task !== undefined && task !== todo.task) { todo.task = task; changed.push("title"); }
  if (description !== undefined && description !== todo.description) { todo.description = description; changed.push("description"); }
  if (priority !== undefined && priority !== todo.priority) { todo.priority = priority; changed.push("priority"); }
  if (dueDate !== undefined && !timeEqual(dueDate, todo.dueDate)) { todo.dueDate = dueDate || null; changed.push("dueDate"); }
  if (tags !== undefined && JSON.stringify(tags) !== JSON.stringify(todo.tags || [])) { todo.tags = tags; changed.push("tags"); }
  if (isPinned !== undefined) todo.isPinned = Boolean(isPinned);
  if (backgroundColor !== undefined && backgroundColor !== todo.backgroundColor) { todo.backgroundColor = backgroundColor; changed.push("theme"); }
  if (status !== undefined && status !== todo.status) { todo.status = status; changed.push("status"); }
  if (reminderAt !== undefined && !timeEqual(reminderAt, todo.reminderAt)) {
    addReminderValidation(reminderAt);
    const hadReminder = Boolean(todo.reminderAt);
    todo.reminderAt = reminderAt || null;
    if (reminderAt) {
      todo.reminderSent = false;
      todo.reminderSentAt = null;
    }
    changed.push("reminder");
    if (hadReminder && !reminderAt) {
      recordHistory(todo, "reminder_cleared", "Reminder removed");
    } else if (!hadReminder && reminderAt) {
      recordHistory(todo, "reminder_set", `Reminder scheduled for ${new Date(reminderAt).toISOString()}`);
    } else if (reminderAt) {
      recordHistory(todo, "reminder_set", `Reminder rescheduled for ${new Date(reminderAt).toISOString()}`);
    }
  }

  if (isPinned !== undefined && todo.isPinned !== wasPinned) {
    recordHistory(todo, todo.isPinned ? "pinned" : "unpinned", todo.isPinned ? "Pinned to top" : "Unpinned");
  }

  if (status !== undefined && todo.status !== wasStatus) {
    recordHistory(todo, todo.status === "completed" ? "completed" : "reopened", `Status changed to ${todo.status}`);
  }

  if (req.files?.length) {
    const newAttachments = req.files.map((f) => ({
      url: `/uploads/${f.filename}`,
      filename: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
    }));
    todo.attachments = [...(todo.attachments || []), ...newAttachments].slice(0, 5);
    changed.push("attachments");
  }

  if (changed.length > 0) {
    todo.lastEditedAt = new Date();
    recordHistory(todo, "edited", `Changed: ${changed.join(", ")}`);
  }

  await todo.save();
  res.status(200).json({ success: true, message: "Task updated.", data: todo });
});

export const removeAttachment = asyncHandler(async (req, res) => {
  const todo = await Todo.findOne({
    _id: req.params.id,
    user: req.user._id,
    isDeleted: false,
  });
  if (!todo) throw ApiError.notFound("Todo not found.");

  const idx = todo.attachments.findIndex(
    (a) => a._id?.toString() === req.params.attachmentId
  );
  if (idx === -1) throw ApiError.notFound("Attachment not found.");

  const [removed] = todo.attachments.splice(idx, 1);
  if (removed?.url) {
    const filePath = path.join(process.cwd(), removed.url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  todo.lastEditedAt = new Date();
  recordHistory(todo, "edited", "Removed attachment");
  await todo.save();
  res.status(200).json({ success: true, message: "Attachment removed.", data: todo });
});

export const reorderTodos = asyncHandler(async (req, res) => {
  const { orders } = req.body;
  if (!Array.isArray(orders)) throw ApiError.badRequest("orders array required");

  const ops = orders.map(({ id, order }) =>
    Todo.updateOne(
      { _id: id, user: req.user._id },
      { $set: { order } }
    )
  );
  await Promise.all(ops);

  const todos = await Todo.find({ user: req.user._id, isDeleted: false, isArchived: false })
    .sort({ isPinned: -1, order: 1, createdAt: -1 });
  res.status(200).json({ success: true, data: todos });
});

export const toggleTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOne({
    _id: req.params.id,
    user: req.user._id,
    isDeleted: false,
  });

  if (!todo) throw ApiError.notFound("Todo not found.");

  const completing = todo.status !== "completed";
  todo.status = completing ? "completed" : "pending";
  recordHistory(todo, completing ? "completed" : "reopened", completing ? "Marked completed" : "Reopened");
  await todo.save();

  res.status(200).json({ success: true, message: "Task updated.", data: todo });
});

export const deleteTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOne({
    _id: req.params.id,
    user: req.user._id,
    isDeleted: false,
  });

  if (!todo) throw ApiError.notFound("Todo not found.");

  todo.isDeleted = true;
  todo.deletedAt = new Date();
  recordHistory(todo, "deleted", "Todo soft-deleted");
  await todo.save();
  res.status(200).json({ success: true, message: "Task deleted." });
});

export const archiveTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOne({
    _id: req.params.id,
    user: req.user._id,
    isDeleted: false,
    isArchived: false,
  });

  if (!todo) throw ApiError.notFound("Todo not found.");

  const wasPinned = todo.isPinned;
  todo.isArchived = true;
  todo.isPinned = false;
  todo.archivedAt = new Date();
  todo.restoredAt = null;
  recordHistory(todo, "archived", wasPinned ? "Archived and unpinned" : "Archived");
  await todo.save();
  res.status(200).json({ success: true, message: "Task archived.", data: todo });
});

export const unarchiveTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOne({
    _id: req.params.id,
    user: req.user._id,
    isDeleted: false,
    isArchived: true,
  });

  if (!todo) throw ApiError.notFound("Todo not found.");

  todo.isArchived = false;
  todo.restoredAt = new Date();
  recordHistory(todo, "restored", "Restored from archive");
  await todo.save();
  res.status(200).json({ success: true, message: "Task restored.", data: todo });
});
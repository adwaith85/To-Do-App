import Todo from "../models/todo.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export const getTodos = asyncHandler(async (req, res) => {
  const todos = await Todo.find({ user: req.user._id, isDeleted: false })
    .sort({ isPinned: -1, order: 1, createdAt: -1 })
    .maxTimeMS(10_000);
  res.status(200).json({ success: true, data: todos });
});

export const getReminders = asyncHandler(async (req, res) => {
  const todos = await Todo.find({
    user: req.user._id,
    isDeleted: false,
    reminderAt: { $ne: null },
  })
    .sort({ reminderAt: 1 })
    .maxTimeMS(10_000);
  res.status(200).json({ success: true, data: todos });
});

export const createTodo = asyncHandler(async (req, res) => {
  const { task, description, priority, dueDate, tags, isPinned, reminderAt, backgroundColor } = req.body;

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

  if (task !== undefined) todo.task = task;
  if (description !== undefined) todo.description = description;
  if (priority !== undefined) todo.priority = priority;
  if (dueDate !== undefined) todo.dueDate = dueDate || null;
  if (tags !== undefined) todo.tags = tags;
  if (isPinned !== undefined) todo.isPinned = Boolean(isPinned);
  if (backgroundColor !== undefined) todo.backgroundColor = backgroundColor;
  if (status !== undefined) todo.status = status;
  if (reminderAt !== undefined) {
    todo.reminderAt = reminderAt || null;
    if (reminderAt) todo.reminderSent = false;
  }

  if (req.files?.length) {
    const newAttachments = req.files.map((f) => ({
      url: `/uploads/${f.filename}`,
      filename: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
    }));
    todo.attachments = [...(todo.attachments || []), ...newAttachments].slice(0, 5);
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

  const todos = await Todo.find({ user: req.user._id, isDeleted: false })
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

  todo.status = todo.status === "completed" ? "pending" : "completed";
  await todo.save();

  res.status(200).json({ success: true, message: "Task updated.", data: todo });
});

export const deleteTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, isDeleted: false },
    { $set: { isDeleted: true } },
    { new: true }
  );

  if (!todo) throw ApiError.notFound("Todo not found.");
  res.status(200).json({ success: true, message: "Task deleted." });
});

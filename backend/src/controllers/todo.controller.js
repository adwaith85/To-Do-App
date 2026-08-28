/**
 * Todo controller — every operation is scoped to the authenticated user.
 *
 * Ownership rule: queries ALWAYS pair `_id` with `req.user._id`, so one
 * user can never read, toggle or delete another user's todo even by
 * guessing ids. A miss returns a neutral 404 (no existence leak).
 *
 * Delete is a SOFT delete (isDeleted: true) — rows live on for a future
 * recycle-bin feature but are filtered out of every list/toggle path.
 */
import Todo from "../models/todo.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

/** GET /api/todos — the current user's ACTIVE todos, pinned first, newest first. */
export const getTodos = asyncHandler(async (req, res) => {
  const todos = await Todo.find({ user: req.user._id, isDeleted: false }).sort({
    isPinned: -1,
    createdAt: -1,
  });
  res.status(200).json({ success: true, data: todos });
});

/** POST /api/todos — create a todo owned by the current user (all metadata). */
export const createTodo = asyncHandler(async (req, res) => {
  const { task, description, priority, dueDate, tags, isPinned } = req.body;

  const todo = await Todo.create({
    task,
    description: description || "",
    priority: priority || "medium",
    dueDate: dueDate || null,
    tags: tags || [],
    isPinned: Boolean(isPinned),
    user: req.user._id, // ownership is NEVER taken from the client
  });

  res.status(201).json({ success: true, message: "Task added.", data: todo });
});

/**
 * PATCH /api/todos/:id — flip pending ⇄ completed.
 * `new: true` returns the updated doc; the user filter enforces ownership
 * and completedAt is set/cleared by the model's pre-validate hook.
 */
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

/** DELETE /api/todos/:id — soft-delete a todo owned by the current user. */
export const deleteTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, isDeleted: false },
    { $set: { isDeleted: true } },
    { new: true }
  );

  if (!todo) throw ApiError.notFound("Todo not found.");

  res.status(200).json({ success: true, message: "Task deleted." });
});
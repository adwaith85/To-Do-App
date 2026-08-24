/**
 * Todo controller — every operation is scoped to the authenticated user.
 *
 * Ownership rule: queries ALWAYS pair `_id` with `req.user._id`, so one
 * user can never read, toggle or delete another user's todo even by
 * guessing ids. A miss returns a neutral 404 (no existence leak).
 */
import Todo from "../models/todo.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

/** GET /api/todos — list the current user's todos, newest first. */
export const getTodos = asyncHandler(async (req, res) => {
  const todos = await Todo.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: todos });
});

/** POST /api/todos — create a todo owned by the current user. */
export const createTodo = asyncHandler(async (req, res) => {
  const { task } = req.body;
  const todo = await Todo.create({ task, user: req.user._id });
  res.status(201).json({ success: true, message: "Task added.", data: todo });
});

/**
 * PATCH /api/todos/:id — flip pending ⇄ completed.
 * `new: true` returns the updated doc; the user filter enforces ownership.
 */
export const toggleTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOne({ _id: req.params.id, user: req.user._id });

  if (!todo) throw ApiError.notFound("Todo not found.");

  todo.status = todo.status === "completed" ? "pending" : "completed";
  await todo.save();

  res.status(200).json({ success: true, message: "Task updated.", data: todo });
});

/** DELETE /api/todos/:id — remove a todo owned by the current user. */
export const deleteTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!todo) throw ApiError.notFound("Todo not found.");

  res.status(200).json({ success: true, message: "Task deleted." });
});

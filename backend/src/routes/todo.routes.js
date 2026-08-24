/**
 * Todo routes → mounted at /api/todos.
 *
 * ALL routes are protected: requireAuth resolves the user from the Bearer
 * access token before any handler runs.
 */
import { Router } from "express";
import { validate } from "../middleware/validate.middleware.js";
import { sanitize } from "../middleware/sanitize.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  getTodos,
  createTodo,
  toggleTodo,
  deleteTodo,
} from "../controllers/todo.controller.js";
import { createTodoSchema, mongoIdParamSchema } from "../validations/index.js";

const router = Router();

router.use(requireAuth); // every route below requires a valid access token

router.get("/", getTodos);
router.post("/", sanitize, validate({ body: createTodoSchema }), createTodo);
router.patch("/:id", sanitize, validate({ params: mongoIdParamSchema }), toggleTodo);
router.delete("/:id", sanitize, validate({ params: mongoIdParamSchema }), deleteTodo);

export default router;

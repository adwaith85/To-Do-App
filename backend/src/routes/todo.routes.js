import { Router } from "express";
import multer from "multer";
import { validate } from "../middleware/validate.middleware.js";
import { sanitize } from "../middleware/sanitize.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  getTodos,
  getArchivedTodos,
  getReminders,
  createTodo,
  updateTodo,
  toggleTodo,
  deleteTodo,
  archiveTodo,
  unarchiveTodo,
  removeAttachment,
  reorderTodos,
} from "../controllers/todo.controller.js";
import { createTodoSchema, updateTodoSchema, mongoIdParamSchema } from "../validations/index.js";

const router = Router();
router.use(requireAuth);

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/|^application\/pdf/.test(file.mimetype);
    cb(null, ok);
  },
});

router.get("/", getTodos);
router.get("/reminders", getReminders);
router.get("/archived", getArchivedTodos);
router.post("/", upload.array("files", 5), sanitize, validate({ body: createTodoSchema }), createTodo);
router.patch("/:id", upload.array("files", 5), sanitize, validate({ params: mongoIdParamSchema }), updateTodo);
router.patch("/:id/toggle", sanitize, validate({ params: mongoIdParamSchema }), toggleTodo);
router.patch("/:id/archive", sanitize, validate({ params: mongoIdParamSchema }), archiveTodo);
router.patch("/:id/unarchive", sanitize, validate({ params: mongoIdParamSchema }), unarchiveTodo);
router.patch("/:id/reorder", sanitize, reorderTodos);
router.delete("/:id/attachments/:attachmentId", sanitize, validate({ params: mongoIdParamSchema }), removeAttachment);
router.delete("/:id", sanitize, validate({ params: mongoIdParamSchema }), deleteTodo);

export default router;

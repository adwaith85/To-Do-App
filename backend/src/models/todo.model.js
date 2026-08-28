/**
 * Todo model — scoped to a user, carrying the full task metadata set.
 *
 * Every query MUST filter by `user`; the requireAuth middleware supplies
 * req.user and controllers enforce ownership. This is what makes the API
 * multi-user safe: users can never read or mutate each other's todos.
 *
 * `task` is the long-standing field name; `title` is the spec's canonical
 * name. A pre-validate hook keeps both perfectly in sync, so either can be
 * written and both are always readable.
 */
import mongoose from "mongoose";

const PRIORITIES = ["low", "medium", "high"];
const STATUSES = ["pending", "in_progress", "completed"];
const MAX_TAGS = 10;

const todoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    task: {
      type: String,
      required: [true, "Task text is required"],
      trim: true,
      minlength: [1, "Task cannot be empty"],
      maxlength: [200, "Task must be at most 200 characters"],
    },
    /** Canonical spec alias of `task` — auto-synced by the pre-validate hook. */
    title: {
      type: String,
      trim: true,
      maxlength: [200, "Title must be at most 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description must be at most 2000 characters"],
      default: "",
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "pending",
    },
    priority: {
      type: String,
      enum: PRIORITIES,
      default: "medium",
    },
    dueDate: { type: Date, default: null },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (tags) =>
          tags.length <= MAX_TAGS &&
          tags.every((t) => t.trim().length > 0 && t.length <= 30),
        message: `Up to ${MAX_TAGS} tags, each 1–30 characters`,
      },
    },
    isPinned: { type: Boolean, default: false },
    /** Soft delete (recycle-bin feature): deleted rows are filtered from lists. */
    isDeleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/**
 * Keep `task` and `title` mirror images, and stamp/clear completedAt when
 * the status flips. Runs before validation so both fields are consistent
 * by the time indexes and required-checks run.
 */
todoSchema.pre("validate", function () {
  if (this.isModified("task")) this.title = this.task;
  if (this.isModified("title")) this.task = this.title;

  if (this.isModified("status")) {
    this.completedAt =
      this.status === "completed" ? this.completedAt || new Date() : null;
  }
});

/* ------------------------------------------------------------------ */
/* Indexes                                                             */
/* ------------------------------------------------------------------ */

// Fast listing per user, newest first; pinned tasks rise to the top.
todoSchema.index({ user: 1, isPinned: -1, createdAt: -1 });
// Active-vs-deleted filtering for the soft-delete feature.
todoSchema.index({ user: 1, isDeleted: 1 });
// Listing by due date (upcoming-tasks views).
todoSchema.index({ user: 1, dueDate: 1 });

const Todo = mongoose.model("Todo", todoSchema);
export default Todo;
export { STATUSES, PRIORITIES };
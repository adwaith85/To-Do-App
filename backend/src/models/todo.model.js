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
    backgroundColor: { type: String, default: "" },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    lastEditedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    restoredAt: { type: Date, default: null },
    reminderAt: { type: Date, default: null },
    reminderSent: { type: Boolean, default: false },
    reminderSentAt: { type: Date, default: null },
    attachments: {
      type: [{
        url: String,
        filename: String,
        mimetype: String,
        size: Number,
      }],
      default: [],
      validate: {
        validator: (a) => a.length <= 5,
        message: "At most 5 attachments",
      },
    },
    order: { type: Number, default: 0 },
    history: {
      type: [{
        action: { type: String, required: true },
        at: { type: Date, default: Date.now },
        detail: { type: String, default: "" },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

todoSchema.pre("validate", function () {
  if (this.isModified("task")) this.title = this.task;
  if (this.isModified("title")) this.task = this.title;
  if (this.isModified("status")) {
    this.completedAt =
      this.status === "completed" ? this.completedAt || new Date() : null;
  }
});

todoSchema.index({ user: 1, isPinned: -1, createdAt: -1 });
todoSchema.index({ user: 1, isDeleted: 1 });
todoSchema.index({ user: 1, isArchived: 1 });
todoSchema.index({ user: 1, dueDate: 1 });
todoSchema.index({ user: 1, reminderAt: 1 });

const Todo = mongoose.model("Todo", todoSchema);
export default Todo;
export { STATUSES, PRIORITIES };

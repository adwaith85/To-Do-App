/**
 * Todo model — now scoped to a user.
 *
 * Every query MUST filter by `user`; the requireAuth middleware supplies
 * req.user and controllers enforce ownership. This is what makes the API
 * multi-user safe: users can never read or mutate each other's todos.
 */
import mongoose from "mongoose";

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
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Fast listing per user, newest first.
todoSchema.index({ user: 1, createdAt: -1 });

const Todo = mongoose.model("Todo", todoSchema);
export default Todo;

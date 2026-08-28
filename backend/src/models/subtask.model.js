/**
 * Subtask model — optional breakdown of a Todo, linked by ownership.
 *
 * A subtask belongs to exactly one todo. Deep queries (e.g. "all my
 * subtasks") always join through the parent todo's `user` ownership check,
 * never by trusting a bare todoId from the client.
 */
import mongoose from "mongoose";

const subtaskSchema = new mongoose.Schema(
  {
    todo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Todo",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Subtask title is required"],
      trim: true,
      minlength: [1, "Subtask title cannot be empty"],
      maxlength: [200, "Subtask title must be at most 200 characters"],
    },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

subtaskSchema.index({ todo: 1, isCompleted: 1 });

const Subtask = mongoose.model("Subtask", subtaskSchema);
export default Subtask;
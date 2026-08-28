/**
 * Attachment model — files linked to a Todo.
 *
 * Only metadata is stored; the binary lives wherever files are hosted
 * (local disk / S3 and the fileUrl points at it). Ownership is always
 * enforced through the parent todo's user, never a bare todoId.
 */
import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    todo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Todo",
      required: true,
      index: true,
    },
    fileUrl: {
      type: String,
      required: [true, "File URL is required"],
      trim: true,
      maxlength: [1024, "File URL is too long"],
    },
    fileType: { type: String, default: "" }, // e.g. image/png, application/pdf
    originalName: { type: String, default: "" },
    sizeBytes: { type: Number, default: 0 },
  },
  { timestamps: true } // createdAt doubles as the spec's uploadedAt
);

// Recent uploads per todo for the attachments view.
attachmentSchema.index({ todo: 1, createdAt: -1 });

const Attachment = mongoose.model("Attachment", attachmentSchema);
export default Attachment;
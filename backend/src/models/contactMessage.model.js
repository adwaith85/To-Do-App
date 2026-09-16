/**
 * ContactMessage — support/help requests submitted from the public login
 * page, triaged by admins in the panel.
 *
 * A message starts "new", gets flipped to "read" the first time an admin
 * opens it, and finally "resolved" once an admin closes the loop (optionally
 * with a note and a handler id for accountability).
 */
import mongoose from "mongoose";

export const CONTACT_CATEGORIES = ["login", "account", "bug", "billing", "other"];

export const CONTACT_STATUSES = ["new", "read", "resolved"];

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, trim: true, maxlength: 254 },
    category: {
      type: String,
      enum: CONTACT_CATEGORIES,
      required: true,
      default: "other",
    },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },

    /** Triage state consumed by the admin panel. */
    status: {
      type: String,
      enum: CONTACT_STATUSES,
      default: "new",
      index: true,
    },

    /** Optional diagnostic context captured anonymously (never the password). */
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "unknown" },

    /** Admin triage trail. */
    adminNote: { type: String, default: "", maxlength: 500 },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Panel default sort: newest first (matches every other admin list).
contactMessageSchema.index({ createdAt: -1 });
// 90-day retention, mirrors LoginHistory.
contactMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const ContactMessage = mongoose.model("ContactMessage", contactMessageSchema);
export default ContactMessage;
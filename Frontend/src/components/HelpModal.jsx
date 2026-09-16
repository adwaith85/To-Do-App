/**
 * HelpModal — support/contact form on the auth pages.
 *
 * Floating "Need help?" affordance that opens a "liquid glass" modal.
 * Posts to POST /api/contact (rate-limited, sanitized, Zod-validated) where
 * it lands in the admin panel's Messages inbox. Always shows a friendly
 * confirmation once submitted.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { X, LifeBuoy, Send } from "lucide-react";
import client from "../api/client";

const CATEGORIES = [
  { value: "login", label: "I can't log in" },
  { value: "account", label: "Account / is my account blocked?" },
  { value: "bug", label: "Reporting a bug" },
  { value: "billing", label: "Billing / plan question" },
  { value: "other", label: "Something else" },
];

const helpSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(50),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  category: z.enum(["login", "account", "bug", "billing", "other"], {
    required_error: "Please choose a topic",
  }),
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(120),
  message: z.string().trim().min(10, "Tell us a bit more (min 10 characters)").max(2000),
});

export default function HelpModal({ open, onClose }) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(helpSchema),
    defaultValues: {
      name: "", email: "", category: "other", subject: "", message: "",
    },
  });

  if (!open) return null;

  const onSubmit = async (vals) => {
    setSubmitting(true);
    try {
      await client.post("/api/contact", vals);
      reset();
      onClose();
      toast.success("Thanks — your message has been sent. We'll get back to you soon.");
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.message ||
        "Couldn't send the message. Please try again.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <div className="animate-modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="liquid-glass animate-modal-sheet relative w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl shadow-black/60 sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 text-white">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white">Need help?</h3>
              <p className="text-xs text-slate-400">
                Tell us what's going on — we usually reply within a day.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close help dialog"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="help-name" className="label-text">Your name</label>
              <input
                id="help-name"
                type="text"
                autoComplete="name"
                placeholder="Jane Doe"
                className={`input-field ${errors.name ? "input-error" : ""}`}
                {...register("name")}
              />
              {errors.name && <p className="error-text">⚠ {errors.name.message}</p>}
            </div>
            <div>
              <label htmlFor="help-email" className="label-text">Email address</label>
              <input
                id="help-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`input-field ${errors.email ? "input-error" : ""}`}
                {...register("email")}
              />
              {errors.email && <p className="error-text">⚠ {errors.email.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="help-category" className="label-text">What's this about?</label>
            <select
              id="help-category"
              className={`input-field ${errors.category ? "input-error" : ""}`}
              {...register("category")}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value} className="bg-slate-900 text-slate-100">
                  {c.label}
                </option>
              ))}
            </select>
            {errors.category && <p className="error-text">⚠ {errors.category.message}</p>}
          </div>

          <div>
            <label htmlFor="help-subject" className="label-text">Subject</label>
            <input
              id="help-subject"
              type="text"
              placeholder="Short summary of the problem"
              className={`input-field ${errors.subject ? "input-error" : ""}`}
              {...register("subject")}
            />
            {errors.subject && <p className="error-text">⚠ {errors.subject.message}</p>}
          </div>

          <div>
            <label htmlFor="help-message" className="label-text">Message</label>
            <textarea
              id="help-message"
              rows={4}
              placeholder="Describe what happened, when, and any error text you saw…"
              className={`input-field resize-none ${errors.message ? "input-error" : ""}`}
              {...register("message")}
            />
            {errors.message && <p className="error-text">⚠ {errors.message.message}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting ? "Sending…" : "Send message"}
          </button>
        </form>
      </div>
    </div>
  );
}
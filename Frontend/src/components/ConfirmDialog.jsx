import { X, AlertTriangle } from "lucide-react";

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900/95 p-6 shadow-2xl backdrop-blur-xl animate-slide-up">
        <button
          onClick={onCancel}
          className="absolute right-3 top-3 rounded-lg p-1 text-slate-500 transition hover:bg-white/5 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15">
          <AlertTriangle className={`h-5 w-5 ${danger ? "text-rose-400" : "text-brand-300"}`} />
        </div>
        <h3 className="mb-1 text-base font-bold text-white">{title}</h3>
        {message && <p className="mb-6 text-sm leading-relaxed text-slate-400">{message}</p>}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary flex-1"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 ${
              danger ? "bg-rose-500 hover:bg-rose-600" : "bg-brand-500 hover:bg-brand-600"
            }`}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
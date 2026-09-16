/**
 * TodoDetailModal — full read view of a single todo record.
 *
 * Renders EVERY field the database stores for a todo so admins can audit
 * the complete lifecycle: title/description, status, priority, timestamps
 * (created/edited/due/completed/archived/restored/deleted), reminder state,
 * pin flag, tags, theme, attachments and the full history[] trail.
 */
import { X, Paperclip, Clock, CheckCircle2, Calendar, History } from "lucide-react";
import { fmtDate } from "./utils";

export default function TodoDetailModal({ todo, onClose }) {
  if (!todo) return null;

  const tags = Array.isArray(todo.tags) ? todo.tags : [];
  const attachments = Array.isArray(todo.attachments) ? todo.attachments : [];
  const history = Array.isArray(todo.history) ? todo.history : [];

  const t = (label, value, cls = "") =>
    value === undefined || value === null || value === "" || value === false ? null : (
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] py-2 last:border-0">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`text-right text-xs font-medium text-slate-200 ${cls}`}>{value}</span>
      </div>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="animate-modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-modal-sheet relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-400/15 bg-slate-950/95 shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-400/10 bg-slate-900/50 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-black text-white">{todo.title || todo.task || "Untitled task"}</h3>
              {todo.isPinned && <span className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">PINNED</span>}
            </div>
            <p className="text-[11px] text-slate-500">{todo.user?.name || todo.user?.email || "No owner"} · created {fmtDate(todo.createdAt, true)}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4">
          {/* Description */}
          {todo.description && (
            <div className="mb-4 rounded-xl border border-slate-400/10 bg-slate-900/40 px-4 py-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{todo.description}</p>
            </div>
          )}

          {/* Core attributes grid */}
          <div className="grid gap-x-6 sm:grid-cols-2">
            <div>
              {t("Status", <StatusTag status={todo.status} />)}
              {t("Priority", <PriorityTag priority={todo.priority} />)}
              {t("Task", todo.task)}
              {t("Title", todo.title)}
              {t("Background", todo.backgroundColor, "font-mono")}
              {t("Order", todo.order)}
            </div>
            <div>
              {t("Due date", todo.dueDate ? <><Calendar className="mr-1 inline h-3 w-3 text-amber-400" />{fmtDate(todo.dueDate, true)}</> : null)}
              {t("Completed at", todo.completedAt ? <><CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-400" />{fmtDate(todo.completedAt, true)}</> : null)}
              {t("Last edited", todo.lastEditedAt ? fmtDate(todo.lastEditedAt, true) : null)}
              {t("Archived at", todo.archivedAt ? fmtDate(todo.archivedAt, true) : null)}
              {t("Restored at", todo.restoredAt ? fmtDate(todo.restoredAt, true) : null)}
              {t("Deleted at", todo.deletedAt ? fmtDate(todo.deletedAt, true) : null)}
            </div>
          </div>

          {/* Reminder state */}
          {todo.reminderAt && (
            <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Clock className="h-3.5 w-3.5" /> Reminder set
                </span>
                <span className="text-[11px] text-slate-400">
                  {fmtDate(todo.reminderAt, true)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                {todo.reminderSent
                  ? <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-400"><CheckCircle2 className="h-3 w-3" /> sent {todo.reminderSentAt ? fmtDate(todo.reminderSentAt, true) : ""}</span>
                  : <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-400">not yet sent</span>}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-md border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Paperclip className="h-3 w-3" /> Attachments ({attachments.length})
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {attachments.map((a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="admin-row-card flex items-center gap-2 rounded-xl border border-slate-400/10 bg-slate-900/40 px-3 py-2 text-xs text-slate-300 hover:border-cyan-400/40"
                  >
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.filename || "attachment"}</span>
                      <span className="text-[10px] text-slate-500">{a.mimetype} · {fmtSize(a.size)}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* History trail */}
          {history.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <History className="h-3 w-3" /> Lifecycle history ({history.length})
              </p>
              <ol className="relative ml-2 space-y-3 border-l border-slate-400/15 pl-4">
                {history.map((h, i) => (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[22px] top-1.5 h-2 w-2 rounded-full ${HISTORY_COLOR[h.action]?.dot || "bg-slate-500"}`} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold capitalize text-slate-200">
                        {String(h.action || "event").replaceAll("_", " ")}
                      </span>
                      <span className="text-[10px] text-slate-500">{h.at ? fmtDate(h.at, true) : ""}</span>
                    </div>
                    {h.detail && <p className="mt-0.5 text-[11px] text-slate-500">{String(h.detail).slice(0, 140)}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-400/10 bg-slate-900/50 px-5 py-3">
          <span className="text-[10px] text-slate-500">Record id · <span className="font-mono">{todo._id}</span></span>
          <button
            onClick={onClose}
            className="admin-btn-secondary !px-3 !py-1.5 text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const HISTORY_COLOR = {
  create: { dot: "bg-cyan-400" },
  edit: { dot: "bg-sky-400" },
  complete: { dot: "bg-emerald-400" },
  archive: { dot: "bg-amber-400" },
  restore: { dot: "bg-teal-400" },
  delete: { dot: "bg-rose-400" },
  reminder: { dot: "bg-violet-400" },
  reminder_set: { dot: "bg-violet-400" },
  reminder_sent: { dot: "bg-violet-400" },
  pin: { dot: "bg-cyan-400" },
  unpin: { dot: "bg-slate-400" },
};

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusTag({ status }) {
  const map = {
    completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    in_progress: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    pending: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  };
  return <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${map[status] || map.pending}`}>{status}</span>;
}

function PriorityTag({ priority }) {
  const map = {
    high: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    medium: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  };
  return <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${map[priority] || map.low}`}>{priority}</span>;
}
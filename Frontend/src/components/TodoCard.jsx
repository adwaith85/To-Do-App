import { Pin, Calendar, Clock, Paperclip, Check, Archive, Trash2 } from "lucide-react";
import { isWhiteTheme } from "../utils/theme";

const priorityTone = {
  low: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  high: "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

const priorityToneLight = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  high: "border-rose-500/30 bg-rose-500/10 text-rose-600",
};

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TodoCard({ todo, onToggle, onDelete, onArchive, onPin, onEdit, onDragStart, onDragOver, onDragEnd }) {
  const isCompleted = todo.status === "completed";
  const isPastDue = todo.reminderAt && new Date(todo.reminderAt) < new Date() && !isCompleted;
  const light = isWhiteTheme(todo.backgroundColor);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, todo)}
      onDragOver={(e) => onDragOver?.(e, todo)}
      onDragEnd={onDragEnd}
      style={todo.backgroundColor ? { background: todo.backgroundColor } : undefined}
      className={`group/article relative flex flex-col rounded-2xl border p-3 transition-all duration-200 sm:p-4 ${
        light
          ? isCompleted
            ? "border-slate-200 bg-white opacity-50"
            : isPastDue
              ? "border-slate-200 bg-white opacity-60"
              : "border-slate-200 bg-white hover:border-brand-300 hover:bg-white hover:shadow-lg hover:shadow-brand-500/10"
          : isCompleted
            ? "border-white/5 bg-white/[0.02] opacity-50"
            : isPastDue
              ? "border-white/10 bg-white/[0.03] opacity-60"
              : "border-white/10 bg-white/[0.04] hover:border-brand-400/30 hover:bg-white/[0.07] hover:shadow-lg hover:shadow-brand-500/5"
      } ${todo.isPinned ? "ring-1 ring-brand-400/25 shadow-[0_0_18px_-6px_rgba(116,94,246,0.4)]" : ""}`}
    >
      {/* Pinned ribbon */}
      {todo.isPinned && (
        <div className="absolute -top-0 left-4 flex -translate-y-1/2 items-center gap-1 rounded-full border border-brand-400/40 bg-brand-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-300 backdrop-blur-sm">
          <Pin className="h-2.5 w-2.5" /> Pinned
        </div>
      )}

      <div className="flex items-start gap-2">
        {/* Drag handle (desktop only) */}
        <div className={`mt-[3px] hidden cursor-grab opacity-0 transition group-hover/article:opacity-100 active:cursor-grabbing sm:block ${light ? "text-slate-400" : "text-slate-600"}`}>
          <span className="inline-block h-3.5 w-3.5 rounded-[2px] border border-dashed border-current" />
        </div>

        {/* Checkbox */}
        <button
          onClick={() => onToggle(todo._id)}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
            isCompleted ? "border-emerald-400 bg-emerald-400 text-white" : light ? "border-slate-300 hover:border-brand-500" : "border-white/20 hover:border-brand-400"
          }`}
        >
          {isCompleted && <Check className="h-3 w-3" />}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onEdit(todo)}>
          <span
            className={`block break-words text-sm font-semibold transition ${
              isCompleted ? "text-slate-400 line-through" : light ? "text-slate-900" : "text-slate-100"
            }`}
          >
            {todo.task}
          </span>

          {todo.description && (
            <p className={`mt-1 line-clamp-2 whitespace-pre-line text-xs leading-relaxed ${light ? "text-slate-500" : "text-slate-400"}`}>
              {todo.description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {todo.priority && todo.priority !== "medium" && (
              <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${light ? priorityToneLight[todo.priority] : priorityTone[todo.priority]}`}>
                {todo.priority}
              </span>
            )}
            {todo.dueDate && (
              <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${light ? "border-slate-200 bg-slate-100 text-slate-600" : "border-white/10 bg-white/5 text-slate-400"}`}>
                <Calendar className="h-2.5 w-2.5" /> {fmtDate(todo.dueDate)}
              </span>
            )}
            {todo.reminderAt && (
              <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${isPastDue ? (light ? "border-slate-300 bg-slate-100 text-slate-500" : "border-slate-400/20 bg-slate-400/10 text-slate-500") : light ? "border-accent-500/30 bg-accent-500/10 text-accent-600" : "border-accent-400/30 bg-accent-400/10 text-accent-400"}`}>
                <Clock className="h-2.5 w-2.5" /> {fmtDateTime(todo.reminderAt)}
              </span>
            )}
            {(todo.tags || []).slice(0, 3).map((t) => (
              <span key={t} className={`rounded-md border px-1.5 py-0.5 text-[10px] ${light ? "border-slate-200 bg-slate-100 text-slate-600" : "border-white/10 bg-white/5 text-slate-400"}`}>
                #{t}
              </span>
            ))}
            {todo.attachments?.length > 0 && (
              <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${light ? "border-slate-200 bg-slate-100 text-slate-600" : "border-white/10 bg-white/5 text-slate-400"}`}>
                <Paperclip className="h-2.5 w-2.5" /> {todo.attachments.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action bar — always visible on touch, hover-revealed on desktop */}
      <div className={`mt-3 flex items-center justify-end gap-1 border-t pt-2.5 opacity-100 transition-opacity duration-200 lg:opacity-0 lg:group-hover/article:opacity-100 lg:focus-within:opacity-100 ${light ? "border-slate-200" : "border-white/5"}`}>
        <button
          onClick={(e) => { e.stopPropagation(); onPin?.(todo); }}
          title={todo.isPinned ? "Unpin from top" : "Pin to top"}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
            todo.isPinned
              ? light ? "bg-brand-500/10 text-brand-600" : "bg-brand-500/20 text-brand-300"
              : light ? "text-slate-400 hover:bg-brand-500/10 hover:text-brand-600" : "text-slate-500 hover:bg-brand-500/15 hover:text-brand-300"
          }`}
        >
          <Pin className={`h-3.5 w-3.5 transition-transform ${todo.isPinned ? "rotate-45" : ""}`} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onArchive?.(todo); }}
          title="Archive"
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${light ? "text-slate-400 hover:bg-amber-500/10 hover:text-amber-600" : "text-slate-500 hover:bg-amber-500/15 hover:text-amber-300"}`}
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(todo._id); }}
          title="Delete"
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${light ? "text-slate-400 hover:bg-rose-500/10 hover:text-rose-600" : "text-slate-500 hover:bg-rose-500/15 hover:text-rose-300"}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
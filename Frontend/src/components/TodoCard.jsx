import { GripVertical, Pin, Calendar, Clock, Paperclip, Check } from "lucide-react";

const priorityTone = {
  low: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  high: "border-rose-400/30 bg-rose-400/10 text-rose-300",
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

export default function TodoCard({ todo, onToggle, onDelete, onEdit, onDragStart, onDragOver, onDragEnd }) {
  const isCompleted = todo.status === "completed";
  const isPastDue = todo.reminderAt && new Date(todo.reminderAt) < new Date() && !isCompleted;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, todo)}
      onDragOver={(e) => onDragOver?.(e, todo)}
      onDragEnd={onDragEnd}
      style={todo.backgroundColor ? { background: todo.backgroundColor } : undefined}
      className={`group relative flex items-start gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 ${
        isCompleted
          ? "border-white/5 bg-white/[0.02] opacity-50"
          : isPastDue
            ? "border-white/10 bg-white/[0.03] opacity-60"
            : "border-white/10 bg-white/[0.04] hover:border-brand-400/30 hover:bg-white/[0.07] hover:shadow-lg hover:shadow-brand-500/5"
      } ${todo.isPinned ? "ring-1 ring-brand-400/20" : ""}`}
    >
      {/* Drag handle */}
      <div className="mt-0.5 cursor-grab text-slate-600 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Checkbox */}
      <button
        onClick={() => onToggle(todo._id)}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
          isCompleted
            ? "border-emerald-400 bg-emerald-400 text-white"
            : "border-white/20 hover:border-brand-400"
        }`}
      >
        {isCompleted && <Check className="h-3 w-3" />}
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1" onClick={() => onEdit(todo)}>
        <span
          className={`block break-words text-sm font-medium cursor-pointer transition ${
            isCompleted ? "text-slate-500 line-through" : "text-slate-100"
          }`}
        >
          {todo.task}
        </span>

        {todo.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{todo.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {todo.isPinned && (
            <span className="inline-flex items-center gap-1 rounded-md border border-brand-400/30 bg-brand-400/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-300">
              <Pin className="h-2.5 w-2.5" /> Pinned
            </span>
          )}
          {todo.priority && todo.priority !== "medium" && (
            <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${priorityTone[todo.priority]}`}>
              {todo.priority}
            </span>
          )}
          {todo.dueDate && (
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
              <Calendar className="h-2.5 w-2.5" /> {fmtDate(todo.dueDate)}
            </span>
          )}
          {todo.reminderAt && (
            <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${isPastDue ? "border-slate-400/20 bg-slate-400/10 text-slate-500" : "border-accent-400/30 bg-accent-400/10 text-accent-400"}`}>
              <Clock className="h-2.5 w-2.5" /> {fmtDateTime(todo.reminderAt)}
            </span>
          )}
          {(todo.tags || []).slice(0, 3).map((t) => (
            <span key={t} className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
              #{t}
            </span>
          ))}
          {todo.attachments?.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
              <Paperclip className="h-2.5 w-2.5" /> {todo.attachments.length}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(todo._id); }}
        title="Delete"
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm text-rose-400 opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/15 hover:text-rose-300"
      >
        ✕
      </button>
    </div>
  );
}
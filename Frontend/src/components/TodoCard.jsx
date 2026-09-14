import { useEffect, useRef, useState } from "react";
import { Pin, Calendar, Clock, Paperclip, Check, Archive, Trash2, History, Loader2, GripVertical } from "lucide-react";
import { isWhiteTheme } from "../utils/theme";
import RichDescription from "./RichDescription";

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
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TodoCard({ todo, section, onToggle, onDelete, onArchive, onPin, onEdit, onGripPointerDown, onBodyPointerDown, dragging = false, dimmed = false, completing = false, countdown = 0 }) {
  const isCompleted = todo.status === "completed";
  const isPastDue = todo.reminderAt && new Date(todo.reminderAt) < new Date() && !isCompleted;
  const light = isWhiteTheme(todo.backgroundColor);

  const updatedAt = todo.lastEditedAt || todo.updatedAt;
  const showUpdated = Boolean(updatedAt && todo.createdAt && new Date(updatedAt).getTime() !== new Date(todo.createdAt).getTime());
  const metaDate = showUpdated ? updatedAt : todo.createdAt;

  const bodyRef = useRef(null);
  const [contentClipped, setContentClipped] = useState(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    let alive = true;
    const check = () => { if (alive) setContentClipped(el.scrollHeight - el.clientHeight > 1); };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    document.fonts?.ready?.then(check);
    return () => { alive = false; ro.disconnect(); };
  }, [todo]);

  return (
    <div
      data-todo-id={todo._id}
      data-todo-section={section}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button === 0) onBodyPointerDown?.(e, todo);
      }}
      style={todo.backgroundColor ? { background: todo.backgroundColor } : undefined}
      className={`group/article relative flex flex-col rounded-2xl border p-3 transition-all duration-200 sm:p-4 ${
        dragging
          ? "z-50 scale-[1.02] opacity-90 ring-2 ring-brand-400/60 shadow-2xl shadow-brand-500/40"
          : dimmed
            ? "opacity-60 saturate-50"
            : ""
      } ${
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
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-brand-400/40 bg-brand-500/20 px-1.5 py-0.5 text-brand-300 backdrop-blur-sm">
          <Pin className="h-3 w-3" />
        </div>
      )}

      <div className="flex items-start gap-1.5">
        {/* Drag handle — works with mouse, touch and pen */}
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            onGripPointerDown?.(e, todo);
          }}
          onDragStart={(e) => e.preventDefault()}
          draggable={false}
          title="Drag to move"
          className={`shrink-0 cursor-grab touch-none select-none p-1 transition active:cursor-grabbing [&_svg]:pointer-events-none ${
            dragging
              ? "cursor-grabbing text-brand-400"
              : light
                ? "text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                : "text-slate-600 hover:bg-white/10 hover:text-brand-300"
          }`}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Checkbox */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onToggle(todo._id)}
          aria-label={isCompleted ? "Mark task not done" : "Mark task done"}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200 sm:h-5 sm:w-5 sm:rounded-md ${
            isCompleted ? "border-emerald-400 bg-emerald-400 text-white" : light ? "border-slate-300 hover:border-brand-500" : "border-white/20 hover:border-brand-400"
          }`}
        >
          {isCompleted && <Check className="h-3.5 w-3.5 sm:h-3 sm:w-3" />}
        </button>

        {/* Content — shows the top, clipped; full content is seen when opened */}
        <div className={`min-w-0 flex-1 cursor-pointer ${todo.isPinned ? "pr-6" : ""}`} onClick={() => onEdit(todo)}>
          <div ref={bodyRef} className="relative max-h-44 overflow-hidden pr-1">
            <span
              className={`block break-words text-sm font-semibold transition ${
                isCompleted ? "text-slate-400 line-through" : light ? "text-slate-900" : "text-slate-100"
              }`}
            >
              {todo.task}
            </span>

            {todo.description && (
              <RichDescription
                description={todo.description}
                light={light}
                textClass={light ? "text-slate-500" : "text-slate-400"}
                className="mt-1 text-xs leading-relaxed"
              />
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
              {(todo.tags || []).map((t) => (
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
              {/* Hint that more content is inside — open the card to see it */}
              {contentClipped && (
                <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-6 ${light ? "bg-gradient-to-t from-white to-transparent" : "bg-gradient-to-t from-black/40 to-transparent"}`} />
              )}
          </div>
        </div>
      </div>

      {/* Bottom bar — stacks on mobile, single row on desktop */}
      <div className={`mt-3 flex flex-col gap-2.5 border-t pt-2.5 sm:flex-row sm:items-center sm:justify-between ${light ? "border-slate-200" : "border-white/5"}`}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500">
          {completing ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 font-semibold text-emerald-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Moving to Completed in {countdown}s
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1">
                <History className="h-3 w-3" />
                {showUpdated ? "Updated" : "Created"} {fmtDate(metaDate)}
              </span>
              {todo.reminderAt && (
                <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${isPastDue ? (light ? "border-slate-300 bg-slate-100 text-slate-500" : "border-slate-400/20 bg-slate-400/10 text-slate-500") : light ? "border-accent-500/30 bg-accent-500/10 text-accent-600" : "border-accent-400/30 bg-accent-400/10 text-accent-400"}`}>
                  <Clock className="h-2.5 w-2.5" /> {fmtDateTime(todo.reminderAt)}
                </span>
              )}
            </>
          )}
        </div>

        {/* Actions — equal-width icon buttons on mobile, compact icons on desktop */}
        <div className="flex w-full shrink-0 items-stretch gap-1.5 sm:w-auto sm:items-center sm:gap-1">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onPin?.(todo); }}
            title={todo.isPinned ? "Unpin from top" : "Pin to top"}
            className={`flex flex-1 items-center justify-center rounded-lg border py-2 transition sm:h-7 sm:w-7 sm:flex-none sm:px-0 sm:py-0 sm:rounded-lg ${
              todo.isPinned
                ? light ? "border-brand-500/30 bg-brand-500/10 text-brand-600" : "border-brand-400/40 bg-brand-500/20 text-brand-300"
                : light ? "border-slate-200 bg-slate-100 text-slate-600 hover:border-brand-500/40 hover:text-brand-600" : "border-white/10 bg-white/5 text-slate-400 hover:border-brand-400/40 hover:text-brand-300"
            }`}
          >
            <Pin className={`h-4 w-4 transition-transform sm:h-3.5 sm:w-3.5 ${todo.isPinned ? "rotate-45" : ""}`} />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onArchive?.(todo); }}
            title="Archive"
            className={`flex flex-1 items-center justify-center rounded-lg border py-2 transition sm:h-7 sm:w-7 sm:flex-none sm:px-0 sm:py-0 sm:rounded-lg ${light ? "border-slate-200 bg-slate-100 text-slate-600 hover:border-amber-500/40 hover:text-amber-600" : "border-white/10 bg-white/5 text-slate-400 hover:border-amber-400/40 hover:text-amber-300"}`}
          >
            <Archive className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(todo._id); }}
            title="Delete"
            className={`flex flex-1 items-center justify-center rounded-lg border py-2 transition sm:h-7 sm:w-7 sm:flex-none sm:px-0 sm:py-0 sm:rounded-lg ${light ? "border-slate-200 bg-slate-100 text-slate-600 hover:border-rose-500/40 hover:text-rose-600" : "border-white/10 bg-white/5 text-slate-400 hover:border-rose-400/40 hover:text-rose-300"}`}
          >
            <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
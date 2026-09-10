import { useState, useRef, useEffect, useCallback } from "react";
import { X, Pin, Bell, Palette, List, Archive, Trash2, Flag, Settings2, Clock } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";
import ThemePicker from "./ThemePicker";
import ReminderPicker from "./ReminderPicker";
import ListEditor from "./ListEditor";
import ConfirmDialog from "./ConfirmDialog";
import { isWhiteTheme } from "../utils/theme";

const pad = (n) => String(n).padStart(2, "0");
const toLocalDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtFullDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
const fmtDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const isEmptyTodo = (t) =>
  !(t?.task || "").trim() &&
  !(t?.description || "").trim() &&
  !t?.dueDate &&
  !t?.reminderAt &&
  !(t?.tags || []).length &&
  !(t?.attachments || []).length &&
  !t?.isPinned &&
  !t?.backgroundColor;

export default function TodoForm({ open, onClose, editTodo = null, onSaved, onArchive, onDelete }) {
  const [form, setForm] = useState({
    task: "",
    description: "",
    priority: "medium",
    isPinned: false,
    reminderAt: "",
    backgroundColor: "",
  });
  const [busy, setBusy] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const titleRef = useRef(null);
  const listRef = useRef(null);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const light = isWhiteTheme(form.backgroundColor);
  const formRef = useRef(form);
  formRef.current = form;
  const dirty = useRef(false);
  const saveTimer = useRef(null);

  const update = (patch) => {
    dirty.current = true;
    setForm((f) => ({ ...f, ...patch }));
  };

  const saveNow = useCallback(async () => {
    const f = formRef.current;
    if (!editTodo?._id) return true;
    try {
      const fd = new FormData();
      fd.append("task", f.task.trim());
      fd.append("description", f.description.trim());
      fd.append("priority", f.priority);
      if (f.reminderAt) fd.append("reminderAt", f.reminderAt);
      fd.append("isPinned", String(f.isPinned));
      if (f.backgroundColor) fd.append("backgroundColor", f.backgroundColor);
      const { data } = await client.patch(`/api/todos/${editTodo._id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const saved = data?.data;
      if (saved && isEmptyTodo(saved)) {
        client.delete(`/api/todos/${editTodo._id}`).catch(() => {});
        dirty.current = false;
        onDelete?.(editTodo._id);
        onClose();
        return true;
      }
      dirty.current = false;
      onSaved?.(data.data);
      return true;
    } catch {
      return false;
    }
  }, [editTodo, onSaved, onDelete, onClose]);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    dirty.current = false;
    if (editTodo) {
      setForm({
        task: editTodo.task || "",
        description: editTodo.description || "",
        priority: editTodo.priority || "medium",
        isPinned: editTodo.isPinned || false,
        reminderAt: toLocalDateTime(editTodo.reminderAt),
        backgroundColor: editTodo.backgroundColor || "",
      });
    } else {
      setForm({ task: "", description: "", priority: "medium", isPinned: false, reminderAt: "", backgroundColor: "" });
    }
    setShowReminder(false);
  }, [editTodo, open]);

  // Autosave: any change made in the form is saved automatically.
  useEffect(() => {
    if (!open) return undefined;
    const id = setTimeout(() => {
      if (dirty.current) saveNow();
    }, 900);
    return () => clearTimeout(id);
  }, [form, open, saveNow]);

  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 100);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearTimeout(saveTimer.current);
    setBusy(true);
    const ok = await saveNow();
    setBusy(false);
    if (!ok) return toast.error("Could not update task");
    onClose();
  };

  const handleClose = () => {
    clearTimeout(saveTimer.current);
    if (dirty.current) saveNow();
    onClose();
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const { data } = await client.patch(`/api/todos/${editTodo._id}/archive`);
      toast.success(data.message || "Task archived");
      onArchive?.(data.data);
      onClose();
    } catch {
      toast.error("Could not archive task");
    } finally {
      setArchiving(false);
    }
  };

  const handleRemove = async () => {
    setDeleting(true);
    try {
      await client.delete(`/api/todos/${editTodo._id}`);
      toast.success("Task deleted");
      onDelete?.(editTodo._id);
      onClose();
    } catch {
      toast.error("Could not delete task");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={handleClose} />
      <div
        className={`relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border bg-ink-900/95 backdrop-blur-xl shadow-2xl animate-slide-up ${light ? "border-slate-200" : "border-white/10"}`}
        style={form.backgroundColor ? { background: form.backgroundColor } : undefined}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between border-b px-5 py-3.5 rounded-t-3xl ${light ? "border-slate-200 bg-white/90 backdrop-blur-xl" : "border-white/10 bg-ink-900/90 backdrop-blur-xl"}`}>
          <h2 className={`text-sm font-bold ${light ? "text-slate-900" : "text-white"}`}>Edit Task</h2>
          <button onClick={handleClose} className={`rounded-lg p-1.5 transition ${light ? "text-slate-500 hover:bg-slate-200 hover:text-slate-900" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
            {/* ─── Left · content ─── */}
            <div className="min-w-0 space-y-4">
              <input
                ref={titleRef}
                type="text"
                value={form.task}
                onChange={(e) => update({ task: e.target.value })}
                placeholder="Title..."
                maxLength={200}
                className={`w-full rounded-xl border px-4 py-3.5 text-base font-semibold outline-none transition focus:ring-4 ${light ? "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-brand-500/15" : "border-white/10 bg-white/[0.04] text-white placeholder:text-slate-600 focus:border-brand-500/50 focus:bg-white/[0.06]"}`}
              />

              <div className={`min-h-24 rounded-xl border p-3 transition ${light ? "border-slate-200 bg-slate-50/60 focus-within:border-brand-500/40" : "border-white/10 bg-white/[0.03] focus-within:border-brand-500/30"}`}>
                <ListEditor
                  ref={listRef}
                  value={form.description}
                  onChange={(v) => update({ description: v })}
                  placeholder="Write a description..."
                  light={light}
                />
              </div>
            </div>

            {/* ─── Right · options ─── */}
            <div className={`space-y-4 rounded-2xl border p-4 ${light ? "border-slate-200 bg-white/40" : "border-white/10 bg-white/[0.03]"}`}>
              <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${light ? "text-slate-500" : "text-slate-400"}`}>
                <Settings2 className="h-3.5 w-3.5" /> Options
              </div>

              {/* Pin / Reminder / Add list */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => update({ isPinned: !form.isPinned })}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all duration-200 ${
                    form.isPinned
                      ? light
                        ? "border-brand-500/40 bg-brand-500/10 text-brand-600 shadow-[0_0_12px_-2px_rgba(116,94,246,0.5)]"
                        : "border-brand-400/60 bg-brand-500/20 text-brand-200 shadow-[0_0_12px_-2px_rgba(116,94,246,0.6)]"
                      : light
                        ? "border-slate-200 bg-slate-100 text-slate-600 hover:border-brand-500/40 hover:text-brand-600"
                        : "border-white/10 bg-white/5 text-slate-400 hover:border-brand-400/40 hover:text-brand-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Pin className={`h-3.5 w-3.5 ${form.isPinned ? "rotate-45" : ""} transition-transform`} /> Pin to top
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${form.isPinned ? (light ? "bg-brand-500/15 text-brand-600" : "bg-brand-500/20 text-brand-200") : light ? "bg-slate-200 text-slate-500" : "bg-white/10 text-slate-500"}`}>
                    {form.isPinned ? "Pinned" : "Off"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowReminder(!showReminder)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all duration-200 ${
                    form.reminderAt
                      ? light
                        ? "border-accent-500/40 bg-accent-500/10 text-accent-600"
                        : "border-accent-400/50 bg-accent-400/15 text-accent-300"
                      : light
                        ? "border-slate-200 bg-slate-100 text-slate-600 hover:border-accent-500/40 hover:text-accent-600"
                        : "border-white/10 bg-white/5 text-slate-400 hover:border-accent-400/40 hover:text-accent-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5" /> {form.reminderAt ? "Reminder set" : "Remind me"}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${form.reminderAt ? (light ? "bg-accent-500/15 text-accent-600" : "bg-accent-500/20 text-accent-300") : light ? "bg-slate-200 text-slate-500" : "bg-white/10 text-slate-500"}`}>
                    {form.reminderAt ? "On" : "Off"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => listRef.current?.startList()}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${light ? "border-brand-500/30 bg-brand-500/5 text-brand-600 hover:bg-brand-500/10" : "border-brand-400/30 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20"}`}
                >
                  <span className="flex items-center gap-2"><List className="h-3.5 w-3.5" /> Add list</span>
                  <List className="h-3 w-3 opacity-60" />
                </button>
              </div>

              {/* Theme */}
              <div>
                <div className={`mb-2 flex items-center gap-2 text-xs font-semibold ${light ? "text-slate-600" : "text-slate-400"}`}>
                  <Palette className="h-3.5 w-3.5" /> Theme
                </div>
                <ThemePicker value={form.backgroundColor} onChange={(v) => update({ backgroundColor: v })} />
              </div>

              {/* Priority */}
              <div>
                <div className={`mb-1.5 flex items-center gap-2 text-xs font-semibold ${light ? "text-slate-600" : "text-slate-400"}`}>
                  <Flag className="h-3.5 w-3.5" /> Priority
                </div>
                <select
                  value={form.priority}
                  onChange={(e) => update({ priority: e.target.value })}
                  className={`w-full rounded-lg border px-2.5 py-2 text-xs outline-none transition focus:border-brand-500/50 cursor-pointer ${light ? "border-slate-200 bg-slate-50 text-slate-700" : "border-white/10 bg-white/[0.03] text-slate-300"}`}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>

          {showReminder && (
            <div className="mt-4">
              <ReminderPicker
                value={form.reminderAt}
                onChange={(v) => update({ reminderAt: v })}
                onDone={() => setShowReminder(false)}
              />
            </div>
          )}

          {/* Dates */}
          <div className={`mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-4 text-[11px] ${light ? "border-slate-200 text-slate-500" : "border-white/10 text-slate-500"}`}>
            <span>Created {fmtFullDate(editTodo?.createdAt)}</span>
            <span aria-hidden>·</span>
            <span>Updated {fmtFullDate(editTodo?.lastEditedAt || editTodo?.updatedAt || editTodo?.createdAt)}</span>
            {editTodo?.reminderAt && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Reminder {fmtDateTime(editTodo.reminderAt)}
                </span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              disabled={deleting}
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-60 ${light ? "border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15" : "border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20"}`}
              title="Delete task"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiving}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${light ? "border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/15" : "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"}`}
            >
              <Archive className="h-4 w-4" /> {archiving ? "..." : "Archive"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={light
                ? "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 hover:text-slate-900"
                : "btn-secondary flex-1 py-2.5 text-sm"}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary flex-1 py-2.5 text-sm"
            >
              {busy ? "Saving..." : "Update"}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={showConfirmDelete}
        title="Delete task?"
        message={`"${editTodo?.task?.slice(0, 60) || "This task"}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setShowConfirmDelete(false)}
        onConfirm={() => { setShowConfirmDelete(false); handleRemove(); }}
      />
    </div>
  );
}

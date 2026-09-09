import { useState, useRef, useEffect } from "react";
import { X, Pin, Bell, Palette, List, Archive, Trash2, Calendar, Flag } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";
import ThemePicker from "./ThemePicker";
import ReminderPicker from "./ReminderPicker";
import ListEditor from "./ListEditor";
import { isWhiteTheme } from "../utils/theme";

const pad = (n) => String(n).padStart(2, "0");
const toLocalDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const toLocalDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function TodoForm({ open, onClose, editTodo = null, onSaved, onArchive, onDelete }) {
  const [form, setForm] = useState({
    task: "",
    description: "",
    priority: "medium",
    dueDate: "",
    tags: "",
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
  const light = isWhiteTheme(form.backgroundColor);

  useEffect(() => {
    if (editTodo) {
      setForm({
        task: editTodo.task || "",
        description: editTodo.description || "",
        priority: editTodo.priority || "medium",
        dueDate: toLocalDate(editTodo.dueDate),
        tags: (editTodo.tags || []).join(", "),
        isPinned: editTodo.isPinned || false,
        reminderAt: toLocalDateTime(editTodo.reminderAt),
        backgroundColor: editTodo.backgroundColor || "",
      });
    } else {
      setForm({ task: "", description: "", priority: "medium", dueDate: "", tags: "", isPinned: false, reminderAt: "", backgroundColor: "" });
    }
    setShowReminder(false);
  }, [editTodo, open]);

  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 100);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.task.trim()) return toast.error("Title is required");

    const fd = new FormData();
    fd.append("task", form.task.trim());
    fd.append("description", form.description.trim());
    fd.append("priority", form.priority);
    if (form.dueDate) fd.append("dueDate", form.dueDate);
    if (form.reminderAt) fd.append("reminderAt", form.reminderAt);
    fd.append("isPinned", String(form.isPinned));
    if (form.backgroundColor) fd.append("backgroundColor", form.backgroundColor);
    form.tags.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => fd.append("tags", t));

    setBusy(true);
    try {
      const { data } = await client.patch(`/api/todos/${editTodo._id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Task updated");
      onSaved?.(data.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update task");
    } finally {
      setBusy(false);
    }
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div
        className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border bg-ink-900/95 backdrop-blur-xl shadow-2xl animate-slide-up ${light ? "border-slate-200" : "border-white/10"}`}
        style={form.backgroundColor ? { background: form.backgroundColor } : undefined}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between border-b px-5 py-3.5 rounded-t-3xl ${light ? "border-slate-200 bg-white/90 backdrop-blur-xl" : "border-white/10 bg-ink-900/90 backdrop-blur-xl"}`}>
          <h2 className={`text-sm font-bold ${light ? "text-slate-900" : "text-white"}`}>Edit Task</h2>
          <button onClick={onClose} className={`rounded-lg p-1.5 transition ${light ? "text-slate-500 hover:bg-slate-200 hover:text-slate-900" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          {/* Title */}
          <input
            ref={titleRef}
            type="text"
            value={form.task}
            onChange={(e) => setForm({ ...form, task: e.target.value })}
            placeholder="Title..."
            maxLength={200}
            className={`mb-2 w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition focus:ring-4 ${light ? "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-brand-500/15" : "border-white/10 bg-white/[0.04] text-white placeholder:text-slate-600 focus:border-brand-500/50 focus:bg-white/[0.06]"}`}
          />

          {/* Description as list/paragraph editor */}
          <ListEditor
            ref={listRef}
            value={form.description}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
            placeholder="Write a description..."
            light={light}
          />

          <div className={`my-3 h-px ${light ? "bg-slate-200" : "bg-white/5"}`} />

          {/* Quick actions */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isPinned: !f.isPinned }))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 ${
                form.isPinned
                  ? light
                    ? "border-brand-500/40 bg-brand-500/10 text-brand-600 shadow-[0_0_12px_-2px_rgba(116,94,246,0.5)]"
                    : "border-brand-400/60 bg-brand-500/20 text-brand-200 shadow-[0_0_12px_-2px_rgba(116,94,246,0.6)]"
                  : light
                    ? "border-slate-200 bg-slate-100 text-slate-600 hover:border-brand-500/40 hover:text-brand-600"
                    : "border-white/10 bg-white/5 text-slate-400 hover:border-brand-400/40 hover:text-brand-300"
              }`}
            >
              <Pin className={`h-3 w-3 ${form.isPinned ? "rotate-45" : ""} transition-transform`} />
              {form.isPinned ? "Pinned to top" : "Pin to top"}
            </button>
            <button
              type="button"
              onClick={() => setShowReminder(!showReminder)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 ${
                form.reminderAt
                  ? light
                    ? "border-accent-500/40 bg-accent-500/10 text-accent-600"
                    : "border-accent-400/50 bg-accent-400/15 text-accent-300"
                  : light
                    ? "border-slate-200 bg-slate-100 text-slate-600 hover:border-accent-500/40 hover:text-accent-600"
                    : "border-white/10 bg-white/5 text-slate-400 hover:border-accent-400/40 hover:text-accent-300"
              }`}
            >
              <Bell className="h-3 w-3" />
              {form.reminderAt ? "Reminder set" : "Remind me"}
            </button>
            <button
              type="button"
              onClick={() => listRef.current?.startList()}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${light ? "border-slate-200 bg-slate-100 text-slate-600 hover:border-brand-500/40 hover:text-brand-600" : "border-white/10 bg-white/5 text-slate-400 hover:border-brand-400/40 hover:text-brand-300"}`}
            >
              <List className="h-3 w-3" /> Add list
            </button>
          </div>

          {showReminder && (
            <div className="mb-4">
              <ReminderPicker
                value={form.reminderAt}
                onChange={(v) => setForm((f) => ({ ...f, reminderAt: v }))}
                onDone={() => setShowReminder(false)}
              />
            </div>
          )}

          {/* Options */}
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-400">
                <Palette className="h-3.5 w-3.5" /> Theme
              </div>
              <ThemePicker value={form.backgroundColor} onChange={(v) => setForm((f) => ({ ...f, backgroundColor: v }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <Flag className="h-3.5 w-3.5" /> Priority
                </div>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 text-xs outline-none transition focus:border-brand-500/50 cursor-pointer ${light ? "border-slate-200 bg-slate-50 text-slate-700" : "border-white/10 bg-white/[0.03] text-slate-300"}`}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <Calendar className="h-3.5 w-3.5" /> Due date
                </div>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 text-xs outline-none transition focus:border-brand-500/50 ${light ? "border-slate-200 bg-slate-50 text-slate-700" : "border-white/10 bg-white/[0.03] text-slate-300"}`}
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-400">
                <List className="h-3.5 w-3.5" /> Tags
              </div>
              <input
                type="text"
                value={form.tags}
                maxLength={300}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="comma separated"
                className={`w-full rounded-lg border px-3 py-2 text-xs outline-none transition focus:border-brand-500/50 ${light ? "border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400" : "border-white/10 bg-white/[0.03] text-slate-300 placeholder:text-slate-600"}`}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleRemove}
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
              disabled={busy || !form.task.trim()}
              className="btn-primary flex-1 py-2.5 text-sm"
            >
              {busy ? "Saving..." : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

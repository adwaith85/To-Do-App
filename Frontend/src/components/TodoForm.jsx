import { useState, useRef, useEffect } from "react";
import { X, Paperclip, Pin, Bell, ChevronDown, ChevronUp, Palette } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";

const BG_OPTIONS = [
  { label: "Default", value: "" },
  { label: "Blue", value: "rgba(56,189,248,0.08)" },
  { label: "Green", value: "rgba(52,211,153,0.08)" },
  { label: "Amber", value: "rgba(251,191,36,0.08)" },
  { label: "Rose", value: "rgba(251,113,133,0.08)" },
  { label: "Violet", value: "rgba(167,139,250,0.08)" },
];

export default function TodoForm({ open, onClose, editTodo = null, onSaved }) {
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
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editTodo) {
      setForm({
        task: editTodo.task || "",
        description: editTodo.description || "",
        priority: editTodo.priority || "medium",
        dueDate: editTodo.dueDate ? new Date(editTodo.dueDate).toISOString().slice(0, 10) : "",
        tags: (editTodo.tags || []).join(", "),
        isPinned: editTodo.isPinned || false,
        reminderAt: editTodo.reminderAt ? new Date(editTodo.reminderAt).toISOString().slice(0, 16) : "",
        backgroundColor: editTodo.backgroundColor || "",
      });
      setShowDetails(true);
    } else {
      setForm({ task: "", description: "", priority: "medium", dueDate: "", tags: "", isPinned: false, reminderAt: "", backgroundColor: "" });
      setShowDetails(false);
    }
    setFiles([]);
  }, [editTodo, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
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
    form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => fd.append("tags", t));
    files.forEach((f) => fd.append("files", f));

    setBusy(true);
    try {
      if (editTodo) {
        const { data } = await client.patch(`/api/todos/${editTodo._id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Task updated");
        onSaved?.(data.data);
      } else {
        const { data } = await client.post("/api/todos", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Task added");
        onSaved?.(data.data);
      }
      onClose();
    } catch {
      toast.error(editTodo ? "Could not update task" : "Could not add task");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-ink-900/95 backdrop-blur-xl shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-ink-900/90 backdrop-blur-xl px-5 py-3.5 rounded-t-3xl">
          <h2 className="text-sm font-bold text-white">{editTodo ? "Edit Task" : "New Task"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          {/* Title — always visible */}
          <input
            ref={inputRef}
            type="text"
            value={form.task}
            onChange={(e) => setForm({ ...form, task: e.target.value })}
            placeholder="What needs doing?"
            maxLength={200}
            className="mb-4 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-brand-500/50 focus:bg-white/[0.06]"
          />

          {/* Expand details toggle */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="mb-4 flex w-full items-center gap-2 rounded-xl border border-dashed border-white/10 px-4 py-2.5 text-xs font-medium text-slate-500 transition hover:border-white/20 hover:text-slate-400"
          >
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showDetails ? "Hide details" : "Add details"}
          </button>

          {/* Expandable details */}
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              showDetails ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden space-y-3.5">
              {/* Reminder */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 w-24 shrink-0">
                  <Bell className="h-3.5 w-3.5" /> Reminder
                </div>
                <input
                  type="datetime-local"
                  value={form.reminderAt}
                  onChange={(e) => setForm({ ...form, reminderAt: e.target.value })}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 outline-none transition focus:border-brand-500/50"
                />
              </div>

              {/* Pin */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 w-24 shrink-0">
                  <Pin className="h-3.5 w-3.5" /> Pin
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isPinned: !form.isPinned })}
                  className={`relative h-5 w-9 rounded-full transition-colors ${form.isPinned ? "bg-brand-500" : "bg-white/10"}`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isPinned ? "translate-x-4" : "translate-x-0.5"}`}
                  />
                </button>
              </div>

              {/* Background color */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 w-24 shrink-0">
                  <Palette className="h-3.5 w-3.5" /> Background
                </div>
                <div className="flex gap-2 flex-wrap">
                  {BG_OPTIONS.map((bg) => (
                    <button
                      key={bg.label}
                      type="button"
                      onClick={() => setForm({ ...form, backgroundColor: bg.value })}
                      title={bg.label}
                      className={`h-6 w-6 rounded-full border-2 transition ${
                        form.backgroundColor === bg.value ? "border-brand-400 scale-110" : "border-white/10 hover:border-white/30"
                      }`}
                      style={{ background: bg.value || "rgba(255,255,255,0.06)" }}
                    />
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 w-24 shrink-0 pt-2.5">
                  Notes
                </div>
                <textarea
                  rows={2}
                  value={form.description}
                  maxLength={2000}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional notes..."
                  className="flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none transition focus:border-brand-500/50"
                />
              </div>

              {/* Priority & Due Date row */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 w-24 shrink-0">
                  Priority
                </div>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 outline-none transition focus:border-brand-50/50 cursor-pointer"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 outline-none transition focus:border-brand-500/50"
                />
              </div>

              {/* Tags */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 w-24 shrink-0">
                  Tags
                </div>
                <input
                  type="text"
                  value={form.tags}
                  maxLength={300}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="comma separated"
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none transition focus:border-brand-500/50"
                />
              </div>

              {/* Attachments */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 w-24 shrink-0">
                  <Paperclip className="h-3.5 w-3.5" /> Files
                </div>
                <div className="flex-1">
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={(e) => setFiles([...e.target.files].slice(0, 5))}
                    className="w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-brand-500/20 file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-brand-300 file:transition file:hover:bg-brand-500/30"
                  />
                  {files.length > 0 && (
                    <p className="mt-1 text-[10px] text-slate-600">{files.length} file(s)</p>
                  )}
                  {editTodo?.attachments?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {editTodo.attachments.map((a, i) => (
                        <span key={i} className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">
                          {a.filename}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !form.task.trim()}
              className="btn-primary flex-1 py-2.5 text-sm"
            >
              {busy ? "Saving..." : editTodo ? "Update" : "Add Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

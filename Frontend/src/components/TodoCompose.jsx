import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Check, Menu, X, Bell, Pin, Palette, Calendar, Flag } from "lucide-react";
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

const PRIORITY_OPTIONS = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

export default function TodoCompose({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState("");
  const [tags, setTags] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [saving, setSaving] = useState(false);

  const areaRef = useRef(null);
  const taskRef = useRef(null);
  const saveTimer = useRef(null);
  const hasTyped = useRef(false);
  const confirming = useRef(false);

  // Auto-focus task input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => taskRef.current?.focus(), 150);
    }
  }, [open]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (areaRef.current && !areaRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const buildPayload = useCallback(() => {
    const fd = new FormData();
    fd.append("task", task.trim());
    fd.append("description", description.trim());
    fd.append("priority", priority);
    fd.append("isPinned", String(isPinned));
    fd.append("backgroundColor", backgroundColor);
    if (dueDate) fd.append("dueDate", dueDate);
    if (reminderAt) fd.append("reminderAt", reminderAt);
    tags.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => fd.append("tags", t));
    return fd;
  }, [task, description, priority, dueDate, reminderAt, isPinned, backgroundColor, tags]);

  const doSave = useCallback(async () => {
    if (saving) return;
    const text = task.trim();
    if (!text && !savedId) return; // nothing to save yet
    if (!text && savedId) {
      // empty — delete the draft
      try { await client.delete(`/api/todos/${savedId}`); } catch {}
      setSavedId(null);
      return;
    }
    setSaving(true);
    try {
      const fd = buildPayload();
      if (savedId) {
        const { data } = await client.patch(`/api/todos/${savedId}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        onCreated?.(data.data, true);
      } else {
        const { data } = await client.post("/api/todos", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setSavedId(data.data._id);
        onCreated?.(data.data, false);
      }
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  }, [task, description, priority, dueDate, reminderAt, isPinned, backgroundColor, tags, savedId, saving, buildPayload, onCreated]);

  // Debounced auto-save while typing
  const scheduleSave = useCallback(() => {
    hasTyped.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(), 1200);
  }, [doSave]);

  const handleTaskChange = (e) => {
    setTask(e.target.value);
    scheduleSave();
  };

  const handleFieldChange = (setter) => (e) => {
    setter(e.target.value);
    scheduleSave();
  };

  const handleBgClick = (bg) => {
    setBackgroundColor(bg);
    scheduleSave();
  };

  const handleTogglePin = () => {
    setIsPinned((p) => !p);
    setTimeout(() => scheduleSave(), 0);
  };

  const handleConfirm = () => {
    confirming.current = true;
    clearTimeout(saveTimer.current);
    doSave();
    collapse();
    setTimeout(() => { confirming.current = false; }, 50);
  };

  const collapse = () => {
    setOpen(false);
    setMenuOpen(false);
    setTask("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setReminderAt("");
    setIsPinned(false);
    setBackgroundColor("");
    setTags("");
    setSavedId(null);
    hasTyped.current = false;
  };

  // Dismiss on outside click — save if typed, delete if empty draft
  const handleBlur = (e) => {
    if (confirming.current) return;
    if (areaRef.current && !areaRef.current.contains(e.relatedTarget)) {
      clearTimeout(saveTimer.current);
      if (hasTyped.current) {
        doSave();
      } else if (savedId) {
        client.delete(`/api/todos/${savedId}`).catch(() => {});
        setSavedId(null);
      }
      collapse();
    }
  };

  // ─── Floating + button ───
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group mb-5 flex h-12 w-full items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 text-sm text-slate-500 transition-all duration-300 hover:border-brand-400/40 hover:bg-brand-500/[0.06] hover:text-slate-300"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400 transition-all duration-300 group-hover:bg-brand-500/25 group-hover:scale-110">
          <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
        </span>
        <span className="transition-opacity duration-300">Add a task...</span>
      </button>
    );
  }

  // ─── Compose area ───
  return (
    <div
      ref={areaRef}
      tabIndex={-1}
      onBlur={handleBlur}
      className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm shadow-xl shadow-brand-500/5 animate-slide-up"
      style={backgroundColor ? { background: backgroundColor } : undefined}
    >
      {/* Top bar: tick + hamburger */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        {saving && (
          <span className="text-[10px] text-slate-600 animate-pulse">saving...</span>
        )}
        {!saving && savedId && (
          <span className="text-[10px] text-emerald-500/70">saved</span>
        )}
        {!saving && !savedId && <span />}
        <div className="flex items-center gap-1">
          <button
            onMouseDown={(e) => { e.preventDefault(); handleConfirm(); }}
            className="rounded-lg p-1.5 text-emerald-400 transition hover:bg-emerald-500/15"
            title="Done"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); setMenuOpen(!menuOpen); }}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            title="Options"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Task input — always visible */}
      <div className="px-4 pb-2">
        <input
          ref={taskRef}
          type="text"
          value={task}
          onChange={handleTaskChange}
          placeholder="What are you working on?"
          maxLength={200}
          className="w-full bg-transparent text-sm font-medium text-white placeholder:text-slate-600 outline-none"
        />
      </div>

      {/* Description — always visible */}
      <div className="px-4 pb-3">
        <textarea
          rows={1}
          value={description}
          maxLength={2000}
          onChange={handleFieldChange(setDescription)}
          placeholder="Add a note..."
          className="w-full resize-none bg-transparent text-xs text-slate-400 placeholder:text-slate-600 outline-none"
        />
      </div>

      {/* Options panel — slides open from hamburger */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          menuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden border-t border-white/5">
          <div className="space-y-3 px-4 py-3">
            {/* Reminder */}
            <div className="flex items-center gap-3">
              <Bell className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <input
                type="datetime-local"
                value={reminderAt}
                onChange={handleFieldChange(setReminderAt)}
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-300 outline-none transition focus:border-brand-500/50"
              />
            </div>

            {/* Pin */}
            <div className="flex items-center gap-3">
              <Pin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <button
                type="button"
                onClick={handleTogglePin}
                className={`relative h-5 w-9 rounded-full transition-colors ${isPinned ? "bg-brand-500" : "bg-white/10"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${isPinned ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
              <span className="text-[11px] text-slate-500">{isPinned ? "Pinned" : "Pin to top"}</span>
            </div>

            {/* Background colors */}
            <div className="flex items-center gap-3">
              <Palette className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <div className="flex gap-2">
                {BG_OPTIONS.map((bg) => (
                  <button
                    key={bg.label}
                    type="button"
                    onClick={() => handleBgClick(bg.value)}
                    title={bg.label}
                    className={`h-5 w-5 rounded-full border-2 transition-all duration-200 ${
                      backgroundColor === bg.value ? "border-brand-400 scale-125" : "border-white/10 hover:border-white/30"
                    }`}
                    style={{ background: bg.value || "rgba(255,255,255,0.06)" }}
                  />
                ))}
              </div>
            </div>

            {/* Due date */}
            <div className="flex items-center gap-3">
              <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <input
                type="date"
                value={dueDate}
                onChange={handleFieldChange(setDueDate)}
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-300 outline-none transition focus:border-brand-500/50"
              />
            </div>

            {/* Priority */}
            <div className="flex items-center gap-3">
              <Flag className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <div className="flex gap-1.5">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => { setPriority(p.value); scheduleSave(); }}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all duration-200 ${
                      priority === p.value
                        ? p.value === "high"
                          ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/30"
                          : p.value === "low"
                            ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30"
                            : "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30"
                        : "bg-white/5 text-slate-500 hover:bg-white/10"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500 shrink-0 font-mono">#</span>
              <input
                type="text"
                value={tags}
                maxLength={300}
                onChange={handleFieldChange(setTags)}
                placeholder="tags, comma, separated"
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 outline-none transition focus:border-brand-500/50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

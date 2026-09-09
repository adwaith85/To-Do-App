import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Check, Menu, X, Bell, Pin, Palette, List } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";
import ThemePicker from "./ThemePicker";
import ReminderPicker from "./ReminderPicker";
import ListEditor from "./ListEditor";
import { isWhiteTheme } from "../utils/theme";

export default function TodoCompose({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [theme, setTheme] = useState("");
  const [tags, setTags] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [saving, setSaving] = useState(false);

  const areaRef = useRef(null);
  const titleRef = useRef(null);
  const saveTimer = useRef(null);
  const hasTyped = useRef(false);
  const confirming = useRef(false);
  const listRef = useRef(null);

  const light = isWhiteTheme(theme);

  const startList = () => {
    listRef.current?.startList();
    setMenuOpen(false);
  };

  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (areaRef.current && !areaRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const buildPayload = useCallback(() => {
    const fd = new FormData();
    fd.append("task", title.trim());
    fd.append("description", description.trim());
    fd.append("priority", priority);
    fd.append("isPinned", String(isPinned));
    fd.append("backgroundColor", theme);
    if (dueDate) fd.append("dueDate", dueDate);
    if (reminderAt) fd.append("reminderAt", reminderAt);
    tags.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => fd.append("tags", t));
    return fd;
  }, [title, description, priority, dueDate, reminderAt, isPinned, theme, tags]);

  const doSave = useCallback(async () => {
    if (saving) return;
    const text = title.trim();
    if (!text && !savedId) return;
    if (!text && savedId) {
      try { await client.delete(`/api/todos/${savedId}`); } catch { /* ignore */ }
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
    } catch (err) {
      if (err.response?.data?.message) toast.error(err.response.data.message);
      else toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  }, [title, savedId, saving, buildPayload, onCreated]);

  const scheduleSave = useCallback(() => {
    hasTyped.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(), 1200);
  }, [doSave]);

  const handleTitleChange = (e) => { setTitle(e.target.value); scheduleSave(); };
  const handleDescChange = useCallback((v) => { setDescription(v); scheduleSave(); }, [scheduleSave]);
  const handleTheme = (v) => { setTheme(v); scheduleSave(); };
  const handleTogglePin = () => { setIsPinned((p) => !p); setTimeout(() => scheduleSave(), 0); };
  const handleReminder = (v) => { setReminderAt(v); scheduleSave(); };

  const handleConfirm = () => {
    confirming.current = true;
    clearTimeout(saveTimer.current);
    doSave();
    collapse();
    setTimeout(() => { confirming.current = false; }, 50);
  };

  const collapse = () => {
    setOpen(false); setMenuOpen(false); setShowReminder(false);
    setTitle(""); setDescription(""); setPriority("medium"); setDueDate("");
    setReminderAt(""); setIsPinned(false); setTheme(""); setTags("");
    setSavedId(null); hasTyped.current = false;
  };

  const handleBlur = (e) => {
    if (confirming.current) return;
    if (areaRef.current && !areaRef.current.contains(e.relatedTarget)) {
      clearTimeout(saveTimer.current);
      if (hasTyped.current) doSave();
      else if (savedId) { client.delete(`/api/todos/${savedId}`).catch(() => {}); setSavedId(null); }
      collapse();
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group mb-5 flex h-12 w-full items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 text-sm text-slate-500 transition-all duration-300 hover:border-brand-400/40 hover:bg-brand-500/[0.06] hover:text-slate-300"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400 transition-all duration-300 group-hover:bg-brand-500/25 group-hover:scale-110">
          <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
        </span>
        <span className="transition-opacity duration-300">Create a new task...</span>
      </button>
    );
  }

  return (
    <div
      ref={areaRef}
      tabIndex={-1}
      onBlur={handleBlur}
      className={`mb-5 overflow-hidden rounded-2xl border backdrop-blur-sm shadow-xl shadow-brand-500/5 animate-slide-up ${
        light ? "border-slate-200 bg-white" : "border-white/10 bg-white/[0.04]"
      }`}
      style={theme ? { background: theme } : undefined}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        {saving ? (
          <span className="text-[10px] text-slate-600 animate-pulse">saving...</span>
        ) : savedId ? (
          <span className="text-[10px] text-emerald-500/70">saved</span>
        ) : <span />}
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
            className={`rounded-lg p-1.5 transition ${light ? "text-slate-500 hover:bg-slate-200 hover:text-slate-900" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
            title="Options"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Title — professional placeholder */}
      <div className="px-4 pb-1.5">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Title..."
          maxLength={200}
          className={`w-full bg-transparent text-sm font-semibold outline-none ${light ? "text-slate-900 placeholder:text-slate-400" : "text-white placeholder:text-slate-600"}`}
        />
      </div>

      {/* Description paragraph */}
      <div className="px-4 pb-1">
        <ListEditor ref={listRef} value={description} onChange={handleDescChange} placeholder="Write a description..." light={light} />
      </div>

      {/* Quick action chips (always visible) */}
      <div className="flex items-center gap-1.5 px-4 pb-2.5 pt-1 flex-wrap">
        <button
          type="button"
          onClick={handleTogglePin}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 ${
            isPinned
              ? light
                ? "border-brand-500/40 bg-brand-500/10 text-brand-600 shadow-[0_0_12px_-2px_rgba(116,94,246,0.5)]"
                : "border-brand-400/60 bg-brand-500/20 text-brand-200 shadow-[0_0_12px_-2px_rgba(116,94,246,0.6)]"
              : light
                ? "border-slate-200 bg-slate-100 text-slate-600 hover:border-brand-500/40 hover:text-brand-600"
                : "border-white/10 bg-white/5 text-slate-400 hover:border-brand-400/40 hover:text-brand-300"
          }`}
        >
          <Pin className={`h-3 w-3 ${isPinned ? "rotate-45" : ""} transition-transform`} />
          {isPinned ? "Pinned to top" : "Pin to top"}
        </button>
        <button
          type="button"
          onClick={() => { setShowReminder(!showReminder); setMenuOpen(false); }}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 ${
            reminderAt
              ? light
                ? "border-accent-500/40 bg-accent-500/10 text-accent-600"
                : "border-accent-400/50 bg-accent-400/15 text-accent-300"
              : light
                ? "border-slate-200 bg-slate-100 text-slate-600 hover:border-accent-500/40 hover:text-accent-600"
                : "border-white/10 bg-white/5 text-slate-400 hover:border-accent-400/40 hover:text-accent-300"
          }`}
        >
          <Bell className="h-3 w-3" />
          {reminderAt ? "Reminder set" : "Remind me"}
        </button>
      </div>

      {/* Reminder picker */}
      {showReminder && (
        <div className="px-4 pb-3">
          <ReminderPicker
            value={reminderAt}
            onChange={handleReminder}
            onDone={() => setShowReminder(false)}
          />
        </div>
      )}

      {/* Options panel */}
      <div className={`grid transition-all duration-300 ease-in-out ${menuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className={`overflow-hidden border-t ${light ? "border-slate-200" : "border-white/5"}`}>
          <div className="space-y-4 px-4 py-3">
            {/* Theme */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                <Palette className="h-3.5 w-3.5" /> Theme
              </div>
              <ThemePicker value={theme} onChange={handleTheme} />
            </div>

            {/* Pin */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                <Pin className="h-3.5 w-3.5" /> Pin
              </div>
              <button
                type="button"
                onClick={handleTogglePin}
                className={`relative flex h-7 w-12 items-center rounded-full px-0.5 transition-colors duration-300 ${
                  isPinned ? "bg-brand-500 shadow-[0_0_14px_-2px_rgba(116,94,246,0.7)]" : "bg-white/10"
                }`}
              >
                <span
                  className={`absolute flex h-6 w-6 items-center justify-center rounded-full bg-white text-brand-500 shadow transition-transform duration-300 ${
                    isPinned ? "translate-x-5 rotate-45" : "translate-x-0"
                  }`}
                >
                  <Pin className="h-3 w-3" />
                </span>
              </button>
              <span className="ml-2 text-[11px] text-slate-500">{isPinned ? "Pinned to top" : "Pin to top"}</span>
            </div>

            {/* Add list — starts list mode in the description */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                <List className="h-3.5 w-3.5" /> Add list
              </div>
              <button
                type="button"
                onClick={startList}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-[11px] font-bold transition ${light ? "border-brand-500/30 bg-brand-500/5 text-brand-600 hover:bg-brand-500/10" : "border-brand-400/30 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20"}`}
              >
                <List className="h-3.5 w-3.5" /> Start a list in the description
              </button>
              <p className={`mt-1.5 text-[10px] leading-relaxed ${light ? "text-slate-500" : "text-slate-600"}`}>
                In list mode, press <span className={light ? "text-slate-700" : "text-slate-400"}>Enter</span> for the next item and <span className={light ? "text-slate-700" : "text-slate-400"}>Enter twice</span> to finish and continue as a paragraph.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-[11px] font-semibold transition ${light ? "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900" : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"}`}
            >
              <X className="h-3.5 w-3.5" /> Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

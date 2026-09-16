/**
 * MessageDetailModal — full read + triage of one support message.
 *
 * Renders every stored field and gives the admin the three triage actions:
 * mark resolved, save an admin note, or delete. Every action mutates the
 * record and the parent re-polls so the list stays in sync.
 */
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { X, Mail, CheckCircle2, Trash2, Save, ShieldCheck, Monitor, Globe, StickyNote } from "lucide-react";
import client from "../../api/client";
import { StatusBadge, CategoryBadge } from "./badges";
import { ConfirmModal } from "./ui";
import { fmtDate } from "./utils";

export default function MessageDetailModal({ message, onClose, onChanged }) {
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setNote(message?.adminNote || "");
  }, [message]);

  if (!message) return null;

  const patch = async (body, successMsg, setBusy) => {
    setBusy?.(true);
    try {
      const { data } = await client.patch(`/api/admin/messages/${message._id}`, body);
      toast.success(successMsg);
      onChanged?.(data.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed.");
    } finally {
      setBusy?.(false);
    }
  };

  const saveNote = () =>
    patch({ adminNote: note.trim() }, note.trim() ? "Note saved." : "Note cleared.", setSavingNote);

  const resolve = () =>
    patch({ status: "resolved" }, "Message marked resolved.", setResolving);

  const del = async () => {
    setDeleting(true);
    try {
      await client.delete(`/api/admin/messages/${message._id}`);
      toast.success("Message deleted.");
      onClose();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const row = (label, value, mono = false) =>
    value === undefined || value === null || value === "" ? null : (
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] py-2 last:border-0">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`text-right text-xs font-medium text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</span>
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
              <h3 className="truncate text-base font-black text-white">{message.subject || "Untitled"}</h3>
              <StatusBadge status={message.status} />
            </div>
            <p className="text-[11px] text-slate-500">
              <Mail className="mr-1 inline h-3 w-3" />{message.email} · from {message.name} · {fmtDate(message.createdAt, true)}
            </p>
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
        <div className="scroll-slim overflow-y-auto px-5 py-4">
          {/* Full message */}
          <div className="rounded-xl border border-slate-400/10 bg-slate-900/40 px-4 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <CategoryBadge category={message.category} />
              <span>Message</span>
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{message.message}</p>
          </div>

          {/* Metadata grid */}
          <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
            <div>
              {row("Name", message.name)}
              {row("Email", message.email)}
              {row("Category", <CategoryBadge category={message.category} />)}
              {row("Status", <StatusBadge status={message.status} />)}
            </div>
            <div>
              {row("Submitted", fmtDate(message.createdAt, true))}
              {row("Last updated", fmtDate(message.updatedAt, true))}
              {row("IP", message.ip, true)}
              {row("User agent", <span className="inline-flex items-center gap-1"><Monitor className="h-3 w-3 text-slate-500" />{String(message.userAgent || "—").slice(0, 60)}</span>)}
            </div>
          </div>

          {/* Triage trail */}
          {message.handledBy && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2.5 text-xs text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Resolved by admin {message.handledBy?.name || String(message.handledBy)} · {fmtDate(message.handledAt, true)}
            </div>
          )}

          {/* Admin note editor */}
          <div className="mt-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <StickyNote className="h-3 w-3" /> Admin note
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Private note for the team (not visible to the user)…"
              className="w-full resize-none rounded-xl border border-slate-400/15 bg-slate-950/40 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
            />
            <button onClick={saveNote} disabled={savingNote} className="admin-btn-secondary mt-2">
              {savingNote ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Save className="h-3.5 w-3.5" />}
              {message.adminNote || note.trim() ? "Update note" : "Add note"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-400/10 bg-slate-900/50 px-5 py-3">
          <span className="font-mono text-[10px] text-slate-500">{message._id}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={del} className="admin-btn-danger !px-3 !py-1.5 text-xs"> <Trash2 className="h-3.5 w-3.5" /> Delete</button>
            {message.status !== "resolved" && (
              <button onClick={resolve} disabled={resolving} className="admin-btn-secondary !px-3 !py-1.5 text-xs">
                {resolving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Mark resolved
              </button>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Globe className="h-3 w-3" /> {message.ip}</span>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Delete this message?"
        message={`"${message.subject}" from ${message.name} will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={del}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
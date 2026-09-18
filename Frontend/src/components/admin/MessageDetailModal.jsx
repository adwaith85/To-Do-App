/**
 * MessageDetailModal — full read + triage of one support message.
 *
 * Renders every stored field and gives the admin the triage actions:
 * reply to the sender's email, mark resolved, or delete. Replies are emailed
 * to the address the message came from and recorded in a visible thread.
 * Every action mutates the record and the parent re-polls to stay in sync.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { X, Mail, CheckCircle2, Trash2, Send, ShieldCheck, Monitor, Globe, Check, Clock } from "lucide-react";
import client from "../../api/client";
import { StatusBadge, CategoryBadge } from "./badges";
import { ConfirmModal } from "./ui";
import { fmtDate } from "./utils";

export default function MessageDetailModal({ message, onClose, onChanged }) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setReply("");
    if (message) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "unset";
      };
    }
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

  const resolve = () =>
    patch({ status: "resolved" }, "Message marked resolved.", setResolving);

  const sendReply = async () => {
    const body = reply.trim();
    if (!body) return;
    setSending(true);
    try {
      const { data } = await client.post(`/api/admin/messages/${message._id}/reply`, { reply: body });
      setReply("");
      toast.success(data.message || "Reply sent.");
      if (data.data) onChanged?.(data.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send reply.");
    } finally {
      setSending(false);
    }
  };

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

  const replies = message.replies || [];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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

          {/* Reply to the sender */}
          <div className="mt-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Send className="h-3 w-3" /> Reply to {message.email}
            </p>

            {replies.length > 0 && (
              <div className="mb-3 space-y-2 rounded-xl border border-slate-400/10 bg-slate-900/30 p-3 empty:hidden">
                {replies.map((r, i) => (
                  <div key={i} className="rounded-lg border border-white/[0.05] bg-slate-950/40 px-3 py-2">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      <span className="inline-flex items-center gap-1 uppercase tracking-wide">
                        {r.delivered ? <Check className="h-3 w-3 text-emerald-400" /> : <Clock className="h-3 w-3 text-amber-400" />}
                        {r.delivered ? "Delivered" : "Not delivered"}
                      </span>
                      <span>· {fmtDate(r.sentAt, true)}</span>
                      {r.to && <span className="truncate font-mono">→ {r.to}</span>}
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{r.body}</p>
                    {r.deliveryError && <p className="mt-1 text-[10px] text-rose-400">Delivery error: {r.deliveryError}</p>}
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={`Write a reply to ${message.name}… it will be emailed to ${message.email}.`}
              className="w-full resize-none rounded-xl border border-slate-400/15 bg-slate-950/40 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button onClick={sendReply} disabled={sending || !reply.trim()} className="admin-btn !px-4 !py-2 text-xs">
                {sending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Send className="h-3.5 w-3.5" />}
                Send reply
              </button>
              <span className="text-[10px] text-slate-500">{reply.trim().length}/2000</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-400/10 bg-slate-900/50 px-5 py-3">
          <span className="font-mono text-[10px] text-slate-500">{message._id}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setConfirmDelete(true)} className="admin-btn-danger !px-3 !py-1.5 text-xs"> <Trash2 className="h-3.5 w-3.5" /> Delete</button>
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
    </div>,
    document.body
  );
}
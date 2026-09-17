import { useState, useEffect } from "react";
import { X, Mail, PhoneIcon, Smartphone, CheckCircle2, CircleX, ShieldCheck } from "lucide-react";
import client from "../../api/client";
import Spinner from "../Spinner";
import { Badge, Avatar } from "./ui";
import { STATUS_TONE, fmtDate, deviceLabel } from "./utils";

import { createPortal } from "react-dom";

export default function UserDetailModal({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    document.body.style.overflow = "hidden";
    
    Promise.all([
      client.get(`/api/admin/users/${userId}`).then((r) => r.data.data),
      client.get(`/api/admin/users/${userId}/sessions`).then((r) => r.data.data.sessions),
    ])
      .then(([detail, sessions]) => {
        setData({ ...detail, sessions });
        setError("");
      })
      .catch(() => setError("Could not load user details."))
      .finally(() => setLoading(false));

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [userId]);

  if (!userId) return null;

  const t = (label, value, cls = "") =>
    value === undefined || value === null || value === "" || value === false ? null : (
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] py-2 last:border-0">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`text-right text-xs font-medium text-slate-200 ${cls}`}>{value}</span>
      </div>
    );

  const u = data?.user || {};
  const todos = data?.todos || {};
  const sessions = data?.sessions || [];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="animate-modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-modal-sheet relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-400/15 bg-slate-950/95 shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-400/10 bg-slate-900/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar name={u.name || "User"} size="md" />
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-white">{u.name || "Loading..."}</h3>
              <p className="text-[11px] text-slate-500">{u.email || ""} {u.role && `· ${u.role}`}</p>
            </div>
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
        <div className="overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="py-8"><Spinner label="Loading details..." /></div>
          ) : error ? (
            <div className="py-8 text-center text-rose-400">{error}</div>
          ) : (
            <div className="space-y-6">
              
              {/* Core Details Grid */}
              <div className="grid gap-x-6 sm:grid-cols-2">
                <div>
                  {t("Status", <Badge tone={STATUS_TONE[u.status] || "slate"} dot>{u.status}</Badge>)}
                  {t("Role", <Badge tone={u.role === "admin" ? "brand" : "slate"}>{u.role}</Badge>)}
                  {t("Email", <span className="flex items-center justify-end gap-1.5"><Mail className="h-3 w-3" />{u.email}</span>)}
                  {t("Phone", u.phone ? <span className="flex items-center justify-end gap-1.5"><PhoneIcon className="h-3 w-3" />{u.phone}</span> : null)}
                  {t("Country code", u.countryCode)}
                  {t("Failed attempts", u.failedLoginAttempts || 0)}
                  {t("Locked until", u.lockUntil ? fmtDate(u.lockUntil, true) : null)}
                </div>
                <div>
                  {t("Joined at", fmtDate(u.createdAt, true))}
                  {t("Updated at", fmtDate(u.updatedAt, true))}
                  {t("Last login", u.lastLoginAt ? <><Smartphone className="mr-1 inline h-3 w-3" />{fmtDate(u.lastLoginAt, true)}</> : "Never")}
                  {t("Last login IP", u.lastLoginIp, "font-mono")}
                  {t("Deactivated at", u.deactivatedAt ? fmtDate(u.deactivatedAt, true) : null)}
                  {t("2FA Method", u.twoFactorEnabled ? u.twoFactorMethod || "email" : "Disabled")}
                </div>
              </div>

              {/* Todo Stats */}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Todo Activity</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-xl border border-slate-400/10 bg-slate-900/30 py-2 text-center">
                    <div className="text-lg font-black text-white">{todos.total || 0}</div>
                    <div className="text-[9px] font-bold uppercase text-slate-500">Total</div>
                  </div>
                  <div className="rounded-xl border border-slate-400/10 bg-slate-900/30 py-2 text-center">
                    <div className="text-lg font-black text-emerald-400">{todos.completed || 0}</div>
                    <div className="text-[9px] font-bold uppercase text-slate-500">Done</div>
                  </div>
                  <div className="rounded-xl border border-slate-400/10 bg-slate-900/30 py-2 text-center">
                    <div className="text-lg font-black text-cyan-300">{todos.active || 0}</div>
                    <div className="text-[9px] font-bold uppercase text-slate-500">Active</div>
                  </div>
                  <div className="rounded-xl border border-slate-400/10 bg-slate-900/30 py-2 text-center">
                    <div className="text-lg font-black text-rose-400">{todos.deleted || 0}</div>
                    <div className="text-[9px] font-bold uppercase text-slate-500">Del</div>
                  </div>
                </div>
              </div>

              {/* Flags */}
              <div className="grid gap-2 sm:grid-cols-3">
                <FlagTile label="Email verified" ok={u.isEmailVerified} />
                <FlagTile label="Phone verified" ok={u.isPhoneVerified} />
                <FlagTile label="2FA enabled" ok={u.twoFactorEnabled} />
              </div>

              {/* Sessions */}
              {sessions.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Sessions ({sessions.length})</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {sessions.map((s) => (
                      <div key={s.id} className="rounded-xl border border-slate-400/10 bg-slate-900/30 p-2 text-xs">
                        <p className="font-semibold text-slate-200">{deviceLabel(s.device)}</p>
                        <p className="text-[10px] text-slate-500">{s.ip} · active {fmtDate(s.lastUsedAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-400/10 bg-slate-900/50 px-5 py-3">
          <span className="text-[10px] text-slate-500">User id · <span className="font-mono">{userId}</span></span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="admin-btn-secondary !px-3 !py-1.5 text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function FlagTile({ label, ok }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
      ok
        ? "border-emerald-500/25 bg-emerald-500/[0.07]"
        : "border-slate-400/10 bg-slate-900/30"
    }`}>
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <CircleX className="h-4 w-4 text-slate-500" />}
      <div>
        <p className={`text-xs font-semibold ${ok ? "text-emerald-300" : "text-slate-400"}`}>{ok ? "On" : "Off"}</p>
        <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      </div>
    </div>
  );
}

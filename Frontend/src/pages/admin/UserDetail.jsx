/**
 * Admin User Detail — /admin/users/:id
 *
 * Full profile, soft todo statistics, security activity timeline and the
 * user's active device sessions (with per-session revoke). Destructive
 * actions are gated behind ConfirmModal + toast like everywhere else in
 * the console.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft, Lock, LockOpen, UserX, UserCheck, LogOut, MonitorSmartphone, ShieldAlert,
  CheckCircle2, CircleX,
} from "lucide-react";
import client from "../../api/client";
import Spinner from "../../components/Spinner";
import {
  Panel, PageHeader, Badge, Empty, Avatar, ConfirmModal,
} from "../../components/admin/ui";
import { STATUS_TONE, fmtDate, deviceLabel } from "../../components/admin/utils";

export default function AdminUserDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null); // { action, session? }

  const load = useCallback(() => {
    Promise.all([
      client.get(`/api/admin/users/${id}`).then((r) => r.data.data),
      client.get(`/api/admin/users/${id}/sessions`).then((r) => r.data.data.sessions),
    ])
      .then(([detail, sessions]) => {
        setData({ ...detail, sessions });
        setError("");
      })
      .catch(() => setError("Could not load this user — they may have been removed."));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const runUserAction = async (action, success) => {
    setBusy("user");
    try {
      await client.patch(`/api/admin/users/${id}/${action}`);
      toast.success(success);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const forceLogout = async () => {
    setBusy("user");
    try {
      const res = await client.delete(`/api/admin/users/${id}/sessions`);
      toast.success(res.data.message || "Signed out everywhere");
      load();
    } catch {
      toast.error("Could not sign the user out");
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const revokeSession = async (session) => {
    setBusy(session.id);
    try {
      const res = await client.delete(`/api/admin/users/${id}/sessions/${session.id}`);
      toast.success(res.data.message || "Session revoked");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not revoke session");
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const copy = {
    lock: { title: "Lock account", msg: "This user will be unable to sign in until you unlock them. All sessions are revoked.", label: "Lock account" },
    unlock: { title: "Unlock account", msg: "Clear the lock-out and failed-attempt counter.", label: "Unlock account", safe: true },
    deactivate: { title: "Deactivate account", msg: "Soft-delete the account and sign them out everywhere.", label: "Deactivate" },
    reactivate: { title: "Reactivate account", msg: "Restore the soft-deleted account.", label: "Reactivate", safe: true },
    signout: { title: "Force sign-out", msg: "Revoke every device session immediately.", label: "Sign out everywhere" },
    revoke: { title: "Revoke session", msg: "End this device session. The user will need to sign in again on that device.", label: "Revoke session" },
  };
  const activeConfirm = confirm && copy[confirm.action];

  if (error) return <div className="alert-error">⚠ {error}</div>;
  if (!data) return <Spinner label="Loading profile…" />;

  const u = data.user || {};
  const todos = data.todos || {};
  const activity = data.activity || [];
  const sessions = data.sessions || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="User profile"
        subtitle={`${u.email || ""}`}
        action={
          <Link to="/admin/users" className="admin-btn-secondary !px-3 !py-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to users
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        {/* ── Profile column ── */}
        <div className="space-y-5 xl:col-span-1">
          <Panel>
            <div className="mb-5 flex items-center gap-4">
              <Avatar name={u.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-white">{u.name}</p>
                <p className="text-xs text-slate-500">{u.phone || "—"} {u.countryCode && `· ${u.countryCode}`}</p>
              </div>
            </div>

            <DetailRow k="Role" v={<Badge tone={u.role === "admin" ? "brand" : "slate"}>{u.role}</Badge>} />
            <DetailRow k="Status" v={<Badge tone={STATUS_TONE[u.status] || "slate"} dot>{u.status}</Badge>} />
            <DetailRow k="Email verified" v={u.isEmailVerified ? <Ok /> : <No />} />
            <DetailRow k="Phone verified" v={u.isPhoneVerified ? <Ok /> : <No />} />
            <DetailRow k="2FA enabled" v={u.twoFactorEnabled ? <Ok /> : <No />} />
            <DetailRow k="Admin code set" v={u.hasAdminCode ? <Ok /> : <No />} />
            <DetailRow k="Failed attempts" v={u.failedLoginAttempts ?? 0} />
            {u.lockUntil && <DetailRow k="Locked until" v={fmtDate(u.lockUntil)} />}
            <DetailRow k="Last login" v={fmtDate(u.lastLoginAt)} />
            <DetailRow k="Joined" v={fmtDate(u.createdAt)} />

            <div className="mt-5 grid grid-cols-3 gap-2">
              {u.status === "locked"
                ? <MiniAction icon={LockOpen} label="Unlock" tone="safe" onClick={() => setConfirm({ action: "unlock" })} />
                : <MiniAction icon={Lock} label="Lock" danger onClick={() => setConfirm({ action: "lock" })} />}
              {u.status === "deactivated"
                ? <MiniAction icon={UserCheck} label="Reactivate" tone="safe" onClick={() => setConfirm({ action: "reactivate" })} />
                : <MiniAction icon={UserX} label="Deactivate" danger onClick={() => setConfirm({ action: "deactivate" })} />}
              <MiniAction icon={LogOut} label="Sign out" danger onClick={() => setConfirm({ action: "signout" })} />
            </div>
          </Panel>

          <Panel title="Todo activity">
            <div className="grid grid-cols-2 gap-3 text-center">
              <CountBox label="Total" value={todos.total} cls="text-white" />
              <CountBox label="Completed" value={todos.completed} cls="text-emerald-400" />
              <CountBox label="Active" value={todos.active} cls="text-cyan-300" />
              <CountBox label="Deleted" value={todos.deleted} cls="text-rose-400" />
            </div>
          </Panel>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5 xl:col-span-2">
          <Panel title="Active sessions" icon={MonitorSmartphone} action={<Badge tone="cyan">{sessions.length} devices</Badge>}>
            {sessions.length === 0 ? <Empty text="No active sessions." /> : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-400/10 bg-slate-900/30 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200">{deviceLabel(s.device)} {s.rememberMe && <Badge tone="amber">remembered</Badge>}</p>
                      <p className="text-[11px] text-slate-500">{s.ip} · last active {fmtDate(s.lastUsedAt)}</p>
                    </div>
                    <button
                      onClick={() => setConfirm({ action: "revoke", session: s })}
                      disabled={busy === s.id}
                      title="Revoke this session"
                      className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-2 text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Security activity" icon={ShieldAlert} action={<Badge tone="slate">{activity.length} events</Badge>}>
            {activity.length === 0 ? <Empty text="No security events recorded." /> : (
              <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {activity.map((ev) => (
                  <li key={ev._id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-400/10 bg-slate-900/30 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold capitalize text-slate-200">{ev.action?.toLowerCase().replaceAll("_", " ")}</p>
                      <p className="text-[11px] text-slate-500">{ev.ip} · {deviceLabel(ev.device)} · {fmtDate(ev.createdAt, true)}</p>
                      {ev.reason && <p className="mt-0.5 text-[11px] text-rose-300/80">{ev.reason}</p>}
                    </div>
                    <Badge tone={ev.status === "success" ? "green" : "red"}>{ev.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(confirm)}
        title={activeConfirm?.title}
        message={activeConfirm?.msg}
        confirmLabel={activeConfirm?.label}
        tone={activeConfirm?.safe ? "safe" : "danger"}
        loading={Boolean(busy)}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm.action === "signout") forceLogout();
          else if (confirm.action === "revoke") revokeSession(confirm.session);
          else if (confirm.action === "lock") runUserAction("lock", "Account locked");
          else if (confirm.action === "unlock") runUserAction("unlock", "Account unlocked");
          else if (confirm.action === "deactivate") runUserAction("deactivate", "Account deactivated");
          else if (confirm.action === "reactivate") runUserAction("reactivate", "Account reactivated");
        }}
      />
    </div>
  );
}

function DetailRow({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-2.5 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{k}</span>
      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-200">{v}</span>
    </div>
  );
}

function Ok() { return <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-4 w-4" /> yes</span>; }
function No() { return <span className="flex items-center gap-1 text-slate-500"><CircleX className="h-4 w-4" /> no</span>; }

function CountBox({ label, value, cls }) {
  return (
    <div className="rounded-xl border border-slate-400/10 bg-slate-900/30 py-3">
      <div className={`text-xl font-black ${cls}`}>{value ?? 0}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function MiniAction({ icon, label, onClick, danger, tone, disabled }) {
  const Icon = icon;
  const cls = danger
    ? "border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
    : tone === "safe"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
      : "border-slate-400/15 bg-slate-900/40 text-slate-300 hover:border-emerald-400/40 hover:text-emerald-300";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition disabled:opacity-40 ${cls}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
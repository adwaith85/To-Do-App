/**
 * Admin Users — Section A: list/filter/search users and manage them.
 *
 * Supports locking/unlocking, deactivating/reactivating, force logout, and
 * viewing a single user's profile + activity timeline + active sessions.
 */
import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import client from "../../api/client";
import Spinner from "../../components/Spinner";
import { Panel, Badge, Pagination, Empty } from "../../components/admin/ui";

const statusTone = {
  active: "green",
  locked: "red",
  deactivated: "red",
  unverified: "amber",
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function deviceLabel(ua = "") {
  const s = String(ua).toLowerCase();
  const b = s.includes("edg/") ? "Edge" : s.includes("chrome") ? "Chrome"
    : s.includes("firefox") ? "Firefox" : s.includes("safari") ? "Safari" : "Browser";
  const os = s.includes("windows") ? "Windows" : s.includes("mac") ? "macOS"
    : s.includes("android") ? "Android" : s.includes("iphone") || s.includes("ipad") ? "iOS"
    : s.includes("linux") ? "Linux" : "";
  return [b, os].filter(Boolean).join(" · ") || "Unknown device";
}

const ACTION_LABEL = {
  lock_user: "Locked user",
  unlock_user: "Unlocked user",
  deactivate_user: "Deactivated user",
  reactivate_user: "Reactivated user",
  force_logout_user: "Forced logout",
  restore_todo: "Restored todo",
  purge_todo: "Purged todo",
};

export default function AdminUsers() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null); // detail of a user
  const [busyId, setBusyId] = useState(null);

  const query = useCallback(() => {
    client
      .get("/api/admin/users", {
        params: { page, limit: 15, search: search || undefined, role: role || undefined, status: status || undefined },
      })
      .then(({ data }) => {
        setRows(data.data.users);
        setTotal(data.data.total);
      })
      .catch(() => setRows([]));
  }, [page, search, role, status]);

  useEffect(() => { query(); }, [query]);

  const loadDetail = useCallback((id) => {
    setSelected(null);
    client
      .get(`/api/admin/users/${id}`)
      .then(({ data }) => setSelected(data.data))
      .catch(() => toast.error("Could not load user details"));
  }, []);

  const runAction = async (id, action, successMsg) => {
    setBusyId(id);
    try {
      await client.patch(`/api/admin/users/${id}/${action}`);
      toast.success(successMsg);
      query();
      if (selected?.user?.id === id) loadDetail(id);
    } catch (err) {
      toast.error(err.response?.data?.message || `Could not ${action} user`);
    } finally {
      setBusyId(null);
    }
  };

  const forceLogout = async (id) => {
    setBusyId(id);
    try {
      const { data } = await client.delete(`/api/admin/users/${id}/sessions`);
      toast.success(data.message || "User signed out");
    } catch {
      toast.error("Could not sign the user out");
    } finally {
      setBusyId(null);
    }
  };

  const filterBar = (
    <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr]">
      <input
        className="input-field"
        placeholder="Search name, email or phone…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
      />
      <select className="input-field cursor-pointer" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
        <option value="">All roles</option>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      <select className="input-field cursor-pointer" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="locked">Locked</option>
        <option value="deactivated">Deactivated</option>
        <option value="unverified">Unverified</option>
      </select>
    </div>
  );

  if (!rows) return (
    <div className="space-y-4">
      {filterBar}
      <Spinner label="Loading users..." />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Panel title="Users" action={<Badge tone="cyan">{total} total</Badge>}>
        {filterBar}
      </Panel>

      {selected && (
        <UserDetail
          data={selected}
          busyId={busyId}
          onClose={() => setSelected(null)}
          onAction={runAction}
          onForceLogout={forceLogout}
        />
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <Panel><Empty text="No users match these filters." /></Panel>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">Name</th>
                  <th className="pb-2 pr-3 font-semibold">Contact</th>
                  <th className="pb-2 pr-3 font-semibold">Role</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 pr-3 font-semibold">Sessions</th>
                  <th className="pb-2 pr-3 font-semibold">Last login</th>
                  <th className="pb-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="py-3 pr-3">
                      <button className="font-semibold text-brand-300 hover:underline" onClick={() => loadDetail(u.id)}>
                        {u.name}
                      </button>
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      <div>{u.email}</div>
                      <div className="text-slate-500">{u.phone}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <Badge tone={u.role === "admin" ? "brand" : "slate"}>{u.role}</Badge>
                    </td>
                    <td className="py-3 pr-3">
                      <Badge tone={statusTone[u.status] || "slate"}>{u.status}</Badge>
                    </td>
                    <td className="py-3 pr-3 text-xs">{u.activeSessions}</td>
                    <td className="py-3 pr-3 text-xs text-slate-500">{fmtDate(u.lastLoginAt)}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {u.status === "locked" ? (
                          <ActionBtn disabled={busyId === u.id} onClick={() => runAction(u.id, "unlock", "Account unlocked")}>Unlock</ActionBtn>
                        ) : (
                          <ActionBtn disabled={busyId === u.id} danger onClick={() => runAction(u.id, "lock", "Account locked")}>Lock</ActionBtn>
                        )}
                        {u.status === "deactivated" ? (
                          <ActionBtn disabled={busyId === u.id} onClick={() => runAction(u.id, "reactivate", "Account reactivated")}>Reactivate</ActionBtn>
                        ) : (
                          <ActionBtn disabled={busyId === u.id} danger onClick={() => runAction(u.id, "deactivate", "Account deactivated")}>Deactivate</ActionBtn>
                        )}
                        <ActionBtn disabled={busyId === u.id} danger onClick={() => forceLogout(u.id)}>Sign out</ActionBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} limit={15} onChange={(p) => setPage(p)} />
        </Panel>
      )}
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition disabled:opacity-40 ${
        danger
          ? "border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
          : "border-brand-500/25 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20"
      }`}
    >
      {children}
    </button>
  );
}

function UserDetail({ data, busyId, onClose, onAction, onForceLogout }) {
  const u = data.user || {};
  const todoCounts = data.todos || {};
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel
        title="User profile"
        action={
          <button className="btn-ghost !py-1 text-xs" onClick={onClose}>✕ Close</button>
        }
      >
        <div className="space-y-2 text-sm">
          <Row k="Name" v={u.name} />
          <Row k="Email" v={u.email} />
          <Row k="Phone" v={u.phone} />
          <Row k="Country" v={u.countryCode} />
          <Row k="Role" v={<Badge tone={u.role === "admin" ? "brand" : "slate"}>{u.role}</Badge>} />
          <Row k="Status" v={<Badge tone={statusTone[u.status]}>{u.status}</Badge>} />
          <Row k="Email verified" v={u.isEmailVerified ? "Yes" : "No"} />
          <Row k="2FA" v={u.twoFactorEnabled ? "On" : "Off"} />
          <Row k="Admin code set" v={u.hasAdminCode ? "Yes" : "No"} />
          <Row k="Failed attempts" v={u.failedLoginAttempts} />
          {u.lockUntil && <Row k="Locked until" v={fmtDate(u.lockUntil)} />}
          <Row k="Last login" v={fmtDate(u.lastLoginAt)} />
          <Row k="Joined" v={fmtDate(u.createdAt)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {u.status === "locked"
            ? <button className="btn-secondary" disabled={busyId === u.id} onClick={() => onAction(u.id, "unlock", "Unlocked")}>Unlock account</button>
            : <button className="btn-danger" disabled={busyId === u.id} onClick={() => onAction(u.id, "lock", "Locked")}>Lock account</button>}
          {u.status === "deactivated"
            ? <button className="btn-secondary" disabled={busyId === u.id} onClick={() => onAction(u.id, "reactivate", "Reactivated")}>Reactivate</button>
            : <button className="btn-danger" disabled={busyId === u.id} onClick={() => onAction(u.id, "deactivate", "Deactivated")}>Deactivate</button>}
          <button className="btn-danger" disabled={busyId === u.id} onClick={() => onForceLogout(u.id)}>Force sign-out</button>
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel title="Todo activity">
          <div className="grid grid-cols-2 gap-3 text-center">
            {[
              { l: "Total", v: todoCounts.total, t: "text-white" },
              { l: "Active", v: todoCounts.active, t: "text-accent-400" },
              { l: "Completed", v: todoCounts.completed, t: "text-emerald-400" },
              { l: "Deleted", v: todoCounts.deleted, t: "text-rose-400" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-white/5 bg-white/[0.03] py-3">
                <div className={`text-xl font-extrabold ${s.t}`}>{s.v ?? 0}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{s.l}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Activity timeline">
          {(data.activity || []).length === 0 ? (
            <Empty text="No security events recorded." />
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {(data.activity || []).map((ev) => (
                <li key={ev._id} className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
                  <div>
                    <div className="font-semibold text-slate-200">{ev.action}</div>
                    <div className="text-slate-500">IP {ev.ip} · {deviceLabel(ev.device)}</div>
                  </div>
                  <Badge tone={ev.status === "success" ? "green" : "red"}>{ev.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{k}</span>
      <span className="truncate font-medium">{v}</span>
    </div>
  );
}

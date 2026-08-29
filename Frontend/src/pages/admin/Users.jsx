/**
 * Admin Users — list, search/filter and manage every account.
 *
 * - Debounced search + role/status filters (server-side).
 * - Sortable columns (client-side within the current page).
 * - Every destructive action (lock / deactivate / force sign-out) goes
 *   through a ConfirmModal and finishes with a toast.
 * - Rows link into /admin/users/:id for the full profile.
 */
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { RefreshCw, Search, Lock, LockOpen, UserX, UserCheck, LogOut, Filter } from "lucide-react";
import client from "../../api/client";
import Spinner from "../../components/Spinner";
import {
  Panel, PageHeader, Badge, Pagination, Empty, Avatar, ConfirmModal, Th,
} from "../../components/admin/ui";
import { STATUS_TONE, fmtDate } from "../../components/admin/utils";

/** Simple debouncer for the search box (avoids hammering the API per keystroke). */
function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function AdminUsers() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { user, action }

  // Sorting lives client-side (current page) — the server already orders
  // the full set by createdAt desc.
  const [sort, setSort] = useState({ key: null, dir: "asc" });

  const load = useCallback(() => {
    client
      .get("/api/admin/users", {
        params: {
          page, limit: 15,
          search: debouncedSearch || undefined,
          role: role || undefined,
          status: status || undefined,
        },
      })
      .then(({ data }) => {
        setRows(data.data.users);
        setTotal(data.data.total);
        setError("");
      })
      .catch((err) => {
        // Surface the real reason (403/401/network…) instead of silently
        // rendering an empty table that looks like a bug.
        setRows([]);
        setError(err.response?.data?.message || "Could not load users. Is the backend reachable?");
      });
  }, [page, debouncedSearch, role, status]);

  useEffect(() => { load(); }, [load]);

  const onSort = (key) => {
    setSort((s) => (s.key === key && s.dir === "asc" ? { key, dir: "desc" } : { key, dir: "asc" }));
  };

  const sorted = useCallback(() => {
    if (!rows) return [];
    if (!sort.key) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      if (av instanceof Date || /^\d{4}-\d{2}-\d{2}T/.test(String(av))) {
        return (new Date(av).getTime() - new Date(bv).getTime()) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sort]);

  const runAction = async (id, action, successMsg) => {
    setBusyId(id);
    try {
      await client.patch(`/api/admin/users/${id}/${action}`);
      toast.success(successMsg);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || `Could not ${action.replace("_", " ")} user`);
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  };

  const forceLogout = async (id) => {
    setBusyId(id);
    try {
      const { data } = await client.delete(`/api/admin/users/${id}/sessions`);
      toast.success(data.message || "User signed out of every device");
      load();
    } catch {
      toast.error("Could not sign the user out");
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  };

  const confirmCopy = {
    lock: { title: "Lock account", msg: "This blocks the user from signing in until you unlock them and revokes every active session.", label: "Lock account" },
    unlock: { title: "Unlock account", msg: "Clears the failed-attempt counter and lifts the lock-out.", label: "Unlock account", tone: "safe" },
    deactivate: { title: "Deactivate account", msg: "The account is soft-deleted. The user is signed out everywhere and cannot log back in.", label: "Deactivate" },
    reactivate: { title: "Reactivate account", msg: "Restores the soft-deleted account and clears any lock-out.", label: "Reactivate", tone: "safe" },
    signout: { title: "Force sign-out", msg: "Revokes every refresh token — the user is logged out on all devices immediately.", label: "Sign out" },
  };
  const activeConfirm = confirm && confirmCopy[confirm.action];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        subtitle={`${total} account${total === 1 ? "" : "s"} across the platform`}
        icon={Filter}
        action={rows && <Badge tone="cyan">{total} total</Badge>}
      />

      <Panel title="Filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.8fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="admin-input !pl-9"
              placeholder="Search name, email or phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className="admin-input cursor-pointer" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="">All roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>
          <select className="admin-input cursor-pointer" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="locked">Locked</option>
            <option value="deactivated">Deactivated</option>
            <option value="unverified">Unverified</option>
          </select>
          <button onClick={load} className="admin-btn-secondary" title="Refresh"><RefreshCw className="h-4 w-4" /> Refresh</button>
        </div>
      </Panel>

      <Panel>
        {error ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-6 py-10 text-center">
            <span className="text-sm font-semibold text-rose-200">{error}</span>
            <button onClick={load} className="admin-btn-secondary !px-3 !py-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : !rows ? <Spinner label="Loading users…" /> : rows.length === 0 ? (
          <Empty text="No users match these filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="admin-table w-full min-w-[860px]">
                <thead>
                  <tr>
                    <Th sortKey="name" sort={sort} onSort={onSort}>User</Th>
                    <Th>Contact</Th>
                    <Th sortKey="role" sort={sort} onSort={onSort}>Role</Th>
                    <Th sortKey="status" sort={sort} onSort={onSort}>Status</Th>
                    <Th>Sessions</Th>
                    <Th sortKey="lastLoginAt" sort={sort} onSort={onSort}>Last login</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted().map((u) => (
                    <tr key={u.id}>
                      <td>
                        <Link to={`/admin/users/${u.id}`} className="group flex items-center gap-3 font-semibold text-slate-100">
                          <Avatar name={u.name} />
                          <span className="truncate group-hover:text-cyan-300">{u.name}</span>
                        </Link>
                      </td>
                      <td className="!text-xs">
                        <div>{u.email}</div>
                        <div className="text-slate-500">{u.phone}</div>
                      </td>
                      <td><Badge tone={u.role === "admin" ? "brand" : "slate"}>{u.role}</Badge></td>
                      <td><Badge tone={STATUS_TONE[u.status] || "slate"} dot>{u.status}</Badge></td>
                      <td className="!text-xs">{u.activeSessions}</td>
                      <td className="!text-xs text-slate-500">{fmtDate(u.lastLoginAt)}</td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {u.status === "locked" ? (
                            <IconBtn title="Unlock" onClick={() => setConfirm({ user: u, action: "unlock" })}><LockOpen className="h-3.5 w-3.5" /></IconBtn>
                          ) : (
                            <IconBtn title="Lock" danger onClick={() => setConfirm({ user: u, action: "lock" })} busy={busyId === u.id}><Lock className="h-3.5 w-3.5" /></IconBtn>
                          )}
                          {u.status === "deactivated" ? (
                            <IconBtn title="Reactivate" onClick={() => setConfirm({ user: u, action: "reactivate" })}><UserCheck className="h-3.5 w-3.5" /></IconBtn>
                          ) : (
                            <IconBtn title="Deactivate" danger onClick={() => setConfirm({ user: u, action: "deactivate" })}><UserX className="h-3.5 w-3.5" /></IconBtn>
                          )}
                          <IconBtn title="Sign out everywhere" danger onClick={() => setConfirm({ user: u, action: "signout" })}><LogOut className="h-3.5 w-3.5" /></IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} limit={15} onChange={setPage} />
          </>
        )}
      </Panel>

      <ConfirmModal
        open={Boolean(confirm)}
        title={activeConfirm?.title}
        message={activeConfirm?.msg}
        confirmLabel={activeConfirm?.label}
        tone={activeConfirm?.tone === "safe" ? "safe" : "danger"}
        loading={busyId === confirm?.user?.id}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm.action === "signout") forceLogout(confirm.user.id);
          else if (confirm.action === "lock") runAction(confirm.user.id, "lock", `${confirm.user.name} locked`);
          else if (confirm.action === "unlock") runAction(confirm.user.id, "unlock", `${confirm.user.name} unlocked`);
          else if (confirm.action === "deactivate") runAction(confirm.user.id, "deactivate", `${confirm.user.name} deactivated`);
          else if (confirm.action === "reactivate") runAction(confirm.user.id, "reactivate", `${confirm.user.name} reactivated`);
        }}
      />
    </div>
  );
}

function IconBtn({ children, onClick, danger, busy, title }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:opacity-40 ${
        danger
          ? "border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
          : "border-slate-400/15 bg-slate-900/40 text-slate-300 hover:border-emerald-400/40 hover:text-emerald-300"
      }`}
    >
      {children}
    </button>
  );
}
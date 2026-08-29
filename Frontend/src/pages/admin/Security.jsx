/**
 * Admin Security — login & security monitoring.
 *
 * Tabs:
 *   Login History → filterable table + CSV export
 *   Failed        → brute-force groupings by IP / user
 *   Sessions      → every active session across users, per-session revoke
 *   Rate Limits   → throttling hit log
 *   Alerts        → suspicious activity feed (derived from failed logins)
 */
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  History, ShieldAlert, Users, Gauge, AlertTriangle, Download, LogOut, RefreshCw,
} from "lucide-react";
import client from "../../api/client";
import Spinner from "../../components/Spinner";
import {
  Panel, PageHeader, Badge, Pagination, Empty, ConfirmModal,
} from "../../components/admin/ui";
import { fmtDate, deviceLabel } from "../../components/admin/utils";

const TABS = [
  { id: "history", label: "Login History", icon: History },
  { id: "failed", label: "Failed", icon: Gauge },
  { id: "sessions", label: "Sessions", icon: Users },
  { id: "ratelimits", label: "Rate Limits", icon: ShieldAlert },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
];

export default function AdminSecurity() {
  const [tab, setTab] = useState("history");
  return (
    <div className="space-y-5">
      <PageHeader title="Login & Security" subtitle="Monitor every authentication event on the platform" icon={ShieldAlert} />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-200"
                : "border-slate-400/10 bg-slate-900/30 text-slate-400 hover:border-slate-400/25 hover:text-white"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "history" && <LoginHistoryTab />}
      {tab === "failed" && <FailedTab />}
      {tab === "sessions" && <SessionsTab />}
      {tab === "ratelimits" && <RateLimitsTab />}
      {tab === "alerts" && <AlertsTab />}
    </div>
  );
}

/* ---------------- Login History ---------------- */
function LoginHistoryTab() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const load = useCallback(() => {
    client.get("/api/admin/login-history", { params: { page, limit: 20, status: status || undefined } })
      .then(({ data }) => { setRows(data.data.events); setTotal(data.data.total); })
      .catch(() => setRows([]));
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const head = "when,user,action,status,ip,device,reason";
    const body = (rows || []).map((e) =>
      [fmtDate(e.createdAt, true), e.emailOrPhone, e.action, e.status, e.ip, e.device, e.reason]
        .map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([`${head}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `login-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Login history exported");
  };

  return (
    <Panel
      title="Login history"
      action={
        <div className="flex flex-wrap gap-2">
          <select className="admin-input !w-auto cursor-pointer !py-1.5" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="failed_password">Wrong password</option>
            <option value="failed_locked">Locked</option>
            <option value="failed_otp">Wrong OTP</option>
          </select>
          <button onClick={exportCsv} disabled={!rows?.length} className="admin-btn-secondary !px-3 !py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Export</button>
          <button onClick={load} className="admin-btn-ghost" title="Refresh"><RefreshCw className="h-4 w-4" /></button>
        </div>
      }
    >
      {!rows ? <Spinner label="Loading…" /> : rows.length === 0 ? <Empty /> : (
        <>
          <div className="overflow-x-auto">
            <table className="admin-table w-full min-w-[680px]">
              <thead>
                <tr>
                  <th>When</th><th>User / identifier</th><th>Action</th><th>Status</th><th>IP / device</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e._id}>
                    <td className="!text-xs text-slate-500">{fmtDate(e.createdAt, true)}</td>
                    <td className="max-w-[180px] truncate !text-xs">{e.emailOrPhone || "—"}</td>
                    <td className="!text-xs font-medium capitalize text-slate-300">{e.action?.toLowerCase().replaceAll("_", " ")}</td>
                    <td><Badge tone={e.status === "success" ? "green" : "red"} dot>{e.status}</Badge></td>
                    <td className="!text-xs">
                      <div className="font-mono">{e.ip}</div>
                      <div className="text-slate-500">{deviceLabel(e.device)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} limit={20} onChange={setPage} />
        </>
      )}
    </Panel>
  );
}

/* ---------------- Failed attempts ---------------- */
function FailedTab() {
  const [data, setData] = useState(null);
  useEffect(() => {
    client.get("/api/admin/login-history/failed").then(({ data }) => setData(data.data)).catch(() => setData(null));
  }, []);

  if (!data) return <Spinner label="Loading failures…" />;
  const grouped = (list, key, sub) =>
    list.map((g) => ({ key: g[key], count: g.count, lastAt: g.lastAt, ips: g.ips, sub }));
  const ipRows = grouped(data.byIp, "_id");
  const userRows = grouped(data.byUser, "user", "email");

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="By IP — brute-force patterns" icon={Gauge}>
        {ipRows.length === 0 ? <Empty /> : (
          <ul className="space-y-2">
            {ipRows.map((g) => (
              <li key={g.key} className="flex items-center justify-between rounded-xl border border-slate-400/10 bg-slate-900/30 px-4 py-3">
                <div>
                  <div className="font-mono text-sm">{g.key}</div>
                  <div className="text-[11px] text-slate-500">last {fmtDate(g.lastAt)}</div>
                </div>
                <Badge tone={g.count > 10 ? "red" : g.count > 5 ? "amber" : "slate"}>{g.count} attempts</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="By user" icon={Users}>
        {userRows.length === 0 ? <Empty /> : (
          <ul className="space-y-2">
            {userRows.map((g) => (
              <li key={String(g.key?._id || g.key)} className="flex items-center justify-between rounded-xl border border-slate-400/10 bg-slate-900/30 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-300">{g.key?.email || g.sub || "Unknown user"}</div>
                  <div className="text-[11px] text-slate-500">{g.ips?.length || g.ips?.length} IPs · last {fmtDate(g.lastAt)}</div>
                </div>
                <Badge tone={g.count > 10 ? "red" : g.count > 5 ? "amber" : "slate"}>{g.count} attempts</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ---------------- Active sessions ---------------- */
function SessionsTab() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    client.get("/api/admin/sessions/active", { params: { page, limit: 25 } })
      .then(({ data }) => { setRows(data.data.sessions); setTotal(data.data.total); })
      .catch(() => setRows([]));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const revoke = async (s) => {
    setBusy(true);
    try {
      const res = await client.delete(`/api/admin/users/${s.userId}/sessions/${s.sessionId}`);
      toast.success(res.data.message || "Session revoked");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not revoke session");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <Panel title="Active sessions (all users)" icon={Users} action={<Badge tone="cyan">{total} sessions</Badge>}>
      {!rows ? <Spinner label="Loading…" /> : rows.length === 0 ? <Empty /> : (
        <>
          <div className="overflow-x-auto">
            <table className="admin-table w-full min-w-[640px]">
              <thead>
                <tr><th>User</th><th>Device</th><th>IP</th><th>Last active</th><th className="text-right">Action</th></tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.sessionId}>
                    <td>
                      <div className="font-semibold text-slate-200">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.email}</div>
                    </td>
                    <td className="!text-xs">{deviceLabel(s.device)} {s.rememberMe && <Badge tone="amber">remembered</Badge>}</td>
                    <td className="font-mono !text-xs">{s.ip}</td>
                    <td className="!text-xs text-slate-500">{fmtDate(s.lastUsedAt)}</td>
                    <td className="text-right">
                      <button
                        onClick={() => setConfirm(s)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/20"
                      >
                        <LogOut className="h-3.5 w-3.5" /> Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} limit={25} onChange={setPage} />
        </>
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title="Revoke session"
        message={`End the session for ${confirm?.name || "this user"} on ${deviceLabel(confirm?.device)} (${confirm?.ip}).`}
        confirmLabel="Revoke session"
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && revoke(confirm)}
      />
    </Panel>
  );
}

/* ---------------- Rate limits ---------------- */
function RateLimitsTab() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    client.get("/api/admin/stats/rate-limits", { params: { page, limit: 20 } })
      .then(({ data }) => setData(data.data))
      .catch(() => setData(null));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <Panel title="Rate-limit hits" icon={Gauge}>
      {!data ? <Spinner label="Loading…" /> : (
        <>
          {data.byLimiter && Object.keys(data.byLimiter).length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(data.byLimiter).map(([k, v]) => <Badge key={k} tone="amber">{k}: {v}</Badge>)}
            </div>
          )}
          {data.hits.length === 0 ? <Empty /> : (
            <>
              <div className="overflow-x-auto">
                <table className="admin-table w-full min-w-[560px]">
                  <thead><tr><th>When</th><th>Limiter</th><th>Request</th><th>IP</th></tr></thead>
                  <tbody>
                    {data.hits.map((h) => (
                      <tr key={h._id}>
                        <td className="!text-xs text-slate-500">{fmtDate(h.createdAt, true)}</td>
                        <td><Badge tone="amber">{h.limiter}</Badge></td>
                        <td className="font-mono !text-xs">{h.method} {h.path}</td>
                        <td className="font-mono !text-xs">{h.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} total={data.total} limit={20} onChange={setPage} />
            </>
          )}
        </>
      )}
    </Panel>
  );
}

/* ---------------- Suspicious alerts ---------------- */
function AlertsTab() {
  const [data, setData] = useState(null);
  useEffect(() => {
    Promise.all([
      client.get("/api/admin/login-history/failed").then((r) => r.data.data),
      client.get("/api/admin/login-history", { params: { status: "failed", limit: 15 } }).then((r) => r.data.data),
    ]).then(([failures, recent]) => setData({ failures, recent: recent.events }))
      .catch(() => setData(null));
  }, []);

  if (!data) return <Spinner label="Scanning for anomalies…" />;

  const highIp = (data.failures?.byIp || []).filter((g) => g.count >= 10);
  const mediumIp = (data.failures?.byIp || []).filter((g) => g.count >= 5 && g.count < 10);
  const highUser = (data.failures?.byUser || []).filter((g) => g.count >= 10);

  return (
    <div className="space-y-5">
      <Panel title="Suspicious login alerts" icon={AlertTriangle}
        action={<Badge tone={highIp.length + highUser.length > 0 ? "red" : "green"}>{highIp.length + highUser.length} high-risk patterns</Badge>}>
        {highIp.length === 0 && mediumIp.length === 0 && highUser.length === 0 ? (
          <Empty text="No suspicious patterns detected right now." />
        ) : (
          <ul className="space-y-2.5">
            {highIp.map((g) => (
              <li key={g._id} className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-rose-200">Brute-force pattern from {g._id}</p>
                  <p className="text-[11px] text-rose-300/70">{g.count} failed attempts · last {fmtDate(g.lastAt)}</p>
                </div>
                <Badge tone="red">HIGH</Badge>
              </li>
            ))}
            {highUser.map((g) => (
              <li key={String(g.user?._id || g._id)} className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-rose-200">{g.user?.email || "Unknown user"} under attack</p>
                  <p className="text-[11px] text-rose-300/70">{g.count} failed attempts from {g.ips?.length || 0} IPs</p>
                </div>
                <Badge tone="red">HIGH</Badge>
              </li>
            ))}
            {mediumIp.map((g) => (
              <li key={g._id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-amber-200">Repeated failures from {g._id}</p>
                  <p className="text-[11px] text-amber-300/70">{g.count} attempts · last {fmtDate(g.lastAt)}</p>
                </div>
                <Badge tone="amber">MEDIUM</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Recent failed logins" icon={History}>
        {(data.recent || []).length === 0 ? <Empty text="No failed logins recorded." /> : (
          <ul className="space-y-2">
            {(data.recent || []).map((e) => (
              <li key={e._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-400/10 bg-slate-900/30 px-4 py-2.5 text-sm">
                <div>
                  <span className="font-mono text-xs">{e.emailOrPhone || "unknown"}</span>
                  <span className="text-[11px] text-slate-500"> · {e.ip}</span>
                </div>
                <span className="text-[11px] text-slate-500">{fmtDate(e.createdAt, true)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
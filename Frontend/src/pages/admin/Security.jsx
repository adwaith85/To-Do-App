/**
 * Admin Security — Section B: login & security monitoring.
 * Tabs: Login History · Failed Attempts · Active Sessions · Rate Limits.
 */
import { useEffect, useState, useCallback } from "react";
import client from "../../api/client";
import Spinner from "../../components/Spinner";
import { Panel, Badge, Pagination, Empty } from "../../components/admin/ui";

const TABS = [
  { id: "history", label: "Login History" },
  { id: "failed", label: "Failed Attempts" },
  { id: "sessions", label: "Active Sessions" },
  { id: "ratelimits", label: "Rate Limits" },
];

function fmt(iso) { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

function deviceLabel(ua = "") {
  const s = String(ua).toLowerCase();
  const b = s.includes("edg/") ? "Edge" : s.includes("chrome") ? "Chrome"
    : s.includes("firefox") ? "Firefox" : s.includes("safari") ? "Safari" : "Browser";
  const os = s.includes("windows") ? "Windows" : s.includes("mac") ? "macOS"
    : s.includes("android") ? "Android" : s.includes("iphone") ? "iOS" : s.includes("linux") ? "Linux" : "";
  return [b, os].filter(Boolean).join(" · ") || "Unknown";
}

export default function AdminSecurity() {
  const [tab, setTab] = useState("history");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === t.id ? "bg-brand-500/20 text-brand-200" : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "history" && <LoginHistoryTab />}
      {tab === "failed" && <FailedTab />}
      {tab === "sessions" && <SessionsTab />}
      {tab === "ratelimits" && <RateLimitsTab />}
    </div>
  );
}

/* ---------------- Login History ---------------- */
function LoginHistoryTab() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  useEffect(() => {
    client.get("/api/admin/login-history", { params: { page, limit: 20, status: status || undefined } })
      .then(({ data }) => { setRows(data.data.events); setTotal(data.data.total); })
      .catch(() => setRows([]));
  }, [page, status]);

  return (
    <Panel
      title="Login history"
      action={
        <select className="input-field !w-auto !py-1.5 cursor-pointer" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="failed_password">Wrong password</option>
          <option value="failed_locked">Locked</option>
          <option value="failed_otp">Wrong OTP</option>
        </select>
      }
    >
      {!rows ? <Spinner label="Loading…" /> : rows.length === 0 ? <Empty /> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">When</th>
                  <th className="pb-2 pr-3 font-semibold">User</th>
                  <th className="pb-2 pr-3 font-semibold">Action</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 pr-3 font-semibold">IP / device</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e._id} className="border-b border-white/5">
                    <td className="py-2.5 pr-3 text-xs text-slate-500">{fmt(e.createdAt)}</td>
                    <td className="py-2.5 pr-3 text-xs">{e.emailOrPhone || "—"}</td>
                    <td className="py-2.5 pr-3 text-xs font-medium">{e.action}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={e.status === "success" ? "green" : "red"}>{e.status}</Badge>
                    </td>
                    <td className="py-2.5 text-xs">
                      <div>{e.ip}</div>
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
    client.get("/api/admin/login-history/failed")
      .then(({ data }) => setData(data.data))
      .catch(() => setData(null));
  }, []);

  if (!data) return <Spinner label="Loading failures…" />;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="By IP (brute-force patterns)">
        {data.byIp.length === 0 ? <Empty /> : (
          <ul className="space-y-2">
            {data.byIp.map((g) => (
              <li key={g._id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2.5 text-sm">
                <div>
                  <div className="font-mono text-xs">{g._id}</div>
                  <div className="text-[11px] text-slate-500">last {fmt(g.lastAt)}</div>
                </div>
                <Badge tone={g.count > 10 ? "red" : "amber"}>{g.count} attempts</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="By user">
        {data.byUser.length === 0 ? <Empty /> : (
          <ul className="space-y-2">
            {data.byUser.map((g) => (
              <li key={String(g.user?._id || g._id)} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2.5 text-sm">
                <div>
                  <div className="font-semibold">{g.user ? g.user.email : "Unknown user"}</div>
                  <div className="text-[11px] text-slate-500">{g.ips.length} IPs · last {fmt(g.lastAt)}</div>
                </div>
                <Badge tone={g.count > 10 ? "red" : "amber"}>{g.count} attempts</Badge>
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

  useEffect(() => {
    client.get("/api/admin/sessions/active", { params: { page, limit: 25 } })
      .then(({ data }) => { setRows(data.data.sessions); setTotal(data.data.total); })
      .catch(() => setRows([]));
  }, [page]);

  return (
    <Panel title="Active sessions (all users)" action={<Badge tone="cyan">{total} users with sessions</Badge>}>
      {!rows ? <Spinner label="Loading…" /> : rows.length === 0 ? <Empty /> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">User</th>
                  <th className="pb-2 pr-3 font-semibold">Device</th>
                  <th className="pb-2 pr-3 font-semibold">IP</th>
                  <th className="pb-2 pr-3 font-semibold">Last active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.sessionId} className="border-b border-white/5">
                    <td className="py-2.5 pr-3 text-xs">
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-slate-500">{s.email}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-xs">{deviceLabel(s.device)} {s.rememberMe && <Badge tone="amber">remembered</Badge>}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{s.ip}</td>
                    <td className="py-2.5 text-xs text-slate-500">{fmt(s.lastUsedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} limit={25} onChange={setPage} />
        </>
      )}
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
    <Panel title="Rate-limit hits">
      {!data ? <Spinner label="Loading…" /> : (
        <>
          {data.byLimiter && Object.keys(data.byLimiter).length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(data.byLimiter).map(([k, v]) => <Badge key={k} tone="brand">{k}: {v}</Badge>)}
            </div>
          )}
          {data.hits.length === 0 ? <Empty /> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="pb-2 pr-3 font-semibold">When</th>
                      <th className="pb-2 pr-3 font-semibold">Limiter</th>
                      <th className="pb-2 pr-3 font-semibold">Request</th>
                      <th className="pb-2 pr-3 font-semibold">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hits.map((h) => (
                      <tr key={h._id} className="border-b border-white/5">
                        <td className="py-2.5 pr-3 text-xs text-slate-500">{fmt(h.createdAt)}</td>
                        <td className="py-2.5 pr-3"><Badge tone="brand">{h.limiter}</Badge></td>
                        <td className="py-2.5 pr-3 font-mono text-xs">{h.method} {h.path}</td>
                        <td className="py-2.5 font-mono text-xs">{h.ip}</td>
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

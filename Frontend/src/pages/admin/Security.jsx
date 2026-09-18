/**
 * Admin Security — login & security monitoring.
 *
 * What it answers, for every auth event: WHO, WHEN (exact date + time),
 * WHERE (IP + location), WHICH SYSTEM (user-agent) and WHAT they did.
 *
 * Tabs:
 *   Activity      → full auth feed (logins, failures, registrations, emails
 *                   verified, logouts, token refreshes, resets, 2FA, session
 *                   revokes) with search / action / status / date filters,
 *                   CSV export and responsive mobile cards.
 *   Sessions      → app sessions GROUPED PER USER. A single row shows one
 *                   user no matter how many refresh tokens they hold — the
 *                   count is a badge. Click "View" for the popup card that
 *                   lists every refresh token with its device, IP, location,
 *                   when it was signed in and when it was last refreshed,
 *                   plus per-session revoke.
 *   Failed        → brute-force groupings by IP / user.
 *   Rate Limits   → throttling hit log.
 *   Alerts        → suspicious activity feed (derived from failed logins).
 *
 * Top stat chips (today) come from /api/admin/security/summary and cover
 * registrations, logins, failures, logouts, token refreshes and live
 * session/token counts. Every region auto-refreshes via usePoll (30s).
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  Activity, ShieldAlert, Users, Gauge, AlertTriangle, Download, LogOut, RefreshCw,
  AlertOctagon, Fingerprint, Lock, ServerCog, Eye, Search, MailCheck, MailX,
  ShieldCheck, ShieldX, LogIn, Zap, KeyRound, UserPlus, X, MonitorSmartphone, Clock,
} from "lucide-react";
import client from "../../api/client";
import {
  Panel, PageHeader, Badge, Pagination, Empty, TabButton, Skeleton, LiveIndicator, Avatar,
} from "../../components/admin/ui";
import { fmtDate, deviceLabel } from "../../components/admin/utils";
import usePoll from "../../components/admin/usePoll";

const TABS = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "sessions", label: "Sessions", icon: Users },
  { id: "failed", label: "Failed", icon: Gauge },
  { id: "ratelimits", label: "Rate Limits", icon: ShieldAlert },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
];

/** Human labels + badge tones for every audited auth action. */
const ACTION_META = {
  REGISTER_INITIATED:    { label: "Registered",      tone: "amber", icon: UserPlus },
  REGISTER_BLOCKED:      { label: "Register blocked", tone: "red",  icon: UserPlus },
  RESEND_OTP:            { label: "OTP resent",      tone: "brand", icon: RefreshCw },
  EMAIL_VERIFY_SUCCESS:  { label: "Email verified",  tone: "green", icon: MailCheck },
  EMAIL_VERIFY_FAILED:   { label: "Verify failed",   tone: "red",  icon: MailX },
  PHONE_VERIFY_SUCCESS:  { label: "Phone verified",  tone: "green", icon: MonitorSmartphone },
  PHONE_VERIFY_FAILED:   { label: "Phone verify failed", tone: "red", icon: MonitorSmartphone },
  PASSWORD_CREATED:      { label: "Password set",    tone: "brand", icon: KeyRound },
  LOGIN_SUCCESS:         { label: "Signed in",       tone: "green", icon: LogIn },
  LOGIN_FAILED:          { label: "Login failed",    tone: "red",  icon: LogIn },
  LOGIN_BLOCKED_LOCKED:  { label: "Blocked (locked)", tone: "red", icon: Lock },
  LOGIN_BLOCKED_UNVERIFIED: { label: "Blocked (unverified)", tone: "amber", icon: ShieldCheck },
  LOGIN_2FA_PENDING:     { label: "2FA pending",     tone: "amber", icon: ShieldCheck },
  LOGIN_2FA_SUCCESS:     { label: "2FA accepted",    tone: "green", icon: ShieldCheck },
  LOGIN_2FA_FAILED:      { label: "2FA failed",      tone: "red",  icon: ShieldX },
  AUTO_LOGIN:            { label: "Auto login",      tone: "cyan", icon: Zap },
  PASSWORD_RESET_REQUESTED: { label: "Reset requested", tone: "amber", icon: KeyRound },
  PASSWORD_RESET_SUCCESS: { label: "Password reset", tone: "green", icon: KeyRound },
  SESSION_REVOKED:       { label: "Session revoked", tone: "amber", icon: LogOut },
  TWO_FACTOR_TOGGLED:    { label: "2FA toggled",     tone: "brand", icon: ShieldCheck },
  TOKEN_REFRESHED:       { label: "Token refreshed", tone: "cyan", icon: RefreshCw },
  TOKEN_REUSE_DETECTED:  { label: "Token reuse!",     tone: "red",  icon: AlertTriangle },
  LOGOUT:                { label: "Signed out",      tone: "gray", icon: LogOut },
  LOGOUT_ALL:            { label: "Signed out (all)", tone: "gray", icon: LogOut },
};

const ACTION_LABEL = (a) => ACTION_META[a]?.label || String(a || "").toLowerCase().replaceAll("_", " ");
const ACTION_TONE = (a) => ACTION_META[a]?.tone || "slate";

const STATUS_TONE_MAP = { success: "green", failed: "red", failed_password: "red", failed_locked: "red", failed_otp: "red" };

export default function AdminSecurity() {
  const [tab, setTab] = useState("activity");

  const summary = usePoll(
    useCallback(() => client.get("/api/admin/security/summary").then((r) => r.data.data), []),
    []
  );

  const { data: s, loaded, refreshing, lastUpdated, refresh } = summary;
  const today = s?.today || {};
  const live = s?.live || {};

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden">
      <PageHeader
        title="Login & Security"
        subtitle="Who did what, when, from where, and on which device — today's auth activity"
        icon={ShieldAlert}
        action={
          <div className="flex items-center gap-2">
            <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} />
            <button onClick={refresh} className="admin-btn-ghost" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        }
      />

      {/* ── Today's auth activity stat chips ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8">
        <StatChip icon={UserPlus} label="Registrations" value={loaded ? today.registrations : "…"} tone="amber" />
        <StatChip icon={MailCheck} label="Emails verified" value={loaded ? today.emailVerified : "…"} tone="green" />
        <StatChip icon={LogIn} label="Logins" value={loaded ? today.logins : "…"} tone="cyan" />
        <StatChip icon={AlertTriangle} label="Failed logins" value={loaded ? today.failedLogins : "…"} tone="rose" danger />
        <StatChip icon={LogOut} label="Logouts" value={loaded ? today.logouts : "…"} tone="slate" />
        <StatChip icon={RefreshCw} label="Token refreshes" value={loaded ? today.tokenRefreshes : "…"} tone="brand" />
        <StatChip icon={Users} label="Active users" value={loaded ? live.activeUsers : "…"} tone="emerald" />
        <StatChip icon={KeyRound} label="Open tokens" value={loaded ? live.totalSessions : "…"} tone="cyan" />
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </TabButton>
        ))}
      </div>

      <div key={tab} className="animate-admin-pop space-y-5">
        {tab === "activity" && <ActivityTab />}
        {tab === "sessions" && <SessionsTab />}
        {tab === "failed" && <FailedTab />}
        {tab === "ratelimits" && <RateLimitsTab />}
        {tab === "alerts" && <AlertsTab />}
      </div>
    </div>
  );
}

function StatChip({ icon, label, value, tone = "cyan", danger }) {
  const Icon = icon;
  const tones = {
    cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-400",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    brand: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    slate: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  };
  return (
    <div className="admin-glass admin-glass-hover animate-stagger relative overflow-hidden p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
          <p className={`truncate text-xl font-black leading-tight ${danger ? "text-rose-400" : "text-white"}`}>{value ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <AlertOctagon className="h-10 w-10 text-rose-400" />
      <p className="text-sm text-slate-400">{message || "Something went wrong."}</p>
      {onRetry && (
        <button onClick={onRetry} className="admin-btn-secondary !px-3 !py-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

function useDebounced(value, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* ---------------- Activity feed (full auth history) ---------------- */
function ActivityTab() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState(null);

  const { refreshing, lastUpdated, refresh } = usePoll(
    useCallback(() =>
      client.get("/api/admin/login-history", {
        params: {
          page,
          limit: 20,
          action: action || undefined,
          status: status || undefined,
          q: debouncedSearch || undefined,
          from: from || undefined,
          to: to ? new Date(new Date(to).getTime() + 86_400_000).toISOString() : undefined,
        },
      }).then(({ data }) => {
        setError(null);
        setRows(data.data.events);
        setTotal(data.data.total);
      }).catch(() => {
        setRows([]);
        setError("Failed to load activity.");
      }),
    [page, action, status, debouncedSearch, from, to]),
    [page, action, status, debouncedSearch, from, to]
  );

  const resetFilters = () => {
    setAction(""); setStatus(""); setSearch(""); setFrom(""); setTo(""); setPage(1);
  };

  const activeFilters = [action, status, debouncedSearch, from, to].filter(Boolean).length;

  const exportCsv = () => {
    const head = "when,date,who,email,identifier,action,status,ip,location,device,reason";
    const body = (rows || []).map((e) => {
      const who = e.userInfo?.name || "";
      const email = e.userInfo?.email || "";
      const identifier = e.userInfo ? "" : e.emailOrPhone || "";
      return [
        fmtDate(e.createdAt, true), e.createdAt, who, email, identifier,
        e.action, e.status, e.ip, e.location || "", e.device, e.reason,
      ]
        .map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(",");
    }).join("\n");
    const blob = new Blob([`${head}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Activity exported");
  };

  return (
    <Panel
      title="Authentication activity"
      icon={Activity}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} />
          {activeFilters > 0 && <Badge tone="amber">{activeFilters} filter{activeFilters > 1 ? "s" : ""}</Badge>}
          <button onClick={exportCsv} disabled={!rows?.length} className="admin-btn-secondary !px-3 !py-1.5 text-xs" title="Export CSV">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={refresh} className="admin-btn-ghost" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="admin-input !py-1.5 !pl-9"
            placeholder="Search who (email / phone)…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="admin-input !py-1.5 cursor-pointer" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">All actions</option>
          {Object.entries(ACTION_META).map(([v, m]) => (
            <option key={v} value={v}>{m.label}</option>
          ))}
        </select>
        <select className="admin-input !py-1.5 cursor-pointer" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="failed_password">Wrong password</option>
          <option value="failed_locked">Locked</option>
          <option value="failed_otp">Wrong OTP</option>
        </select>
        <input type="date" className="admin-input !py-1.5 cursor-pointer" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} title="From date" />
        <input type="date" className="admin-input !py-1.5 cursor-pointer" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} title="To date" />
        <button onClick={resetFilters} disabled={activeFilters === 0} className="admin-btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-30">
          Clear
        </button>
      </div>

      {error ? <ErrorState message={error} onRetry={refresh} /> : !rows ? <Skeleton lines={5} /> : rows.length === 0 ? <Empty text="No authentication events match these filters." /> : (
        <>
          {/* ── Desktop table ── */}
          <div className="hidden overflow-x-auto md:block">
            <table className="admin-table w-full min-w-[980px]">
              <thead>
                <tr>
                  <th>When</th><th>Who</th><th>Action</th><th>Status</th><th>IP / location</th><th>System</th><th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e._id}>
                    <td className="whitespace-nowrap !text-xs text-slate-500">{fmtDate(e.createdAt, true)}</td>
                    <td>
                      {e.userInfo ? (
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-200">{e.userInfo.name}</div>
                          <div className="truncate text-xs text-slate-500">{e.userInfo.email}</div>
                        </div>
                      ) : (
                        <div className="max-w-[180px] truncate font-mono !text-xs text-slate-400">{e.emailOrPhone || "—"}</div>
                      )}
                    </td>
                    <td>
                      <Badge tone={ACTION_TONE(e.action)}>
                        <span className="inline-flex items-center gap-1">
                          {ACTION_LABEL(e.action)}
                        </span>
                      </Badge>
                    </td>
                    <td><Badge tone={STATUS_TONE_MAP[e.status] || "slate"} dot>{e.status}</Badge></td>
                    <td className="!text-xs">
                      <div className="font-mono">{e.ip}</div>
                      {e.location ? <div className="text-slate-500">{e.location}</div> : <div className="text-slate-600">location unknown</div>}
                    </td>
                    <td className="!text-xs">
                      <div className="max-w-[180px] truncate text-slate-300">{deviceLabel(e.device)}</div>
                      <div className="max-w-[180px] truncate text-[10px] text-slate-600">{e.device}</div>
                    </td>
                    <td className="max-w-[220px] truncate !text-xs text-slate-500">{e.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ── */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {rows.map((e) => (
              <div key={e._id} className="admin-row-card min-w-0 w-full rounded-xl border border-slate-400/10 bg-slate-900/40 p-4">
                <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
                  <Badge tone={ACTION_TONE(e.action)}>{ACTION_LABEL(e.action)}</Badge>
                  <span className="text-[11px] text-slate-500">{fmtDate(e.createdAt, true)}</span>
                </div>
                <div className="mt-2 min-w-0">
                  {e.userInfo ? (
                    <>
                      <p className="truncate text-sm font-bold text-white">{e.userInfo.name} <span className="font-medium text-slate-500">· {e.userInfo.email}</span></p>
                    </>
                  ) : (
                    <p className="truncate font-mono text-xs text-slate-400">{e.emailOrPhone || "Unknown identifier"}</p>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span className="font-mono">{e.ip}</span>
                  <span>·</span>
                  <span className="truncate">{deviceLabel(e.device)}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={STATUS_TONE_MAP[e.status] || "slate"} dot>{e.status}</Badge>
                  {e.reason && <span className="min-w-0 truncate text-[11px] text-rose-300/80">{e.reason}</span>}
                </div>
              </div>
            ))}
          </div>

          <Pagination page={page} total={total} limit={20} onChange={setPage} />
        </>
      )}
    </Panel>
  );
}

/* ---------------- App sessions (grouped per user + refresh-token popup) ---------------- */
function SessionsTab() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  const { refreshing, lastUpdated, refresh } = usePoll(
    useCallback(() =>
      client.get("/api/admin/sessions/active", { params: { page, limit: 25 } })
        .then(({ data }) => {
          setError(null);
          setRows(data.data.users);
          setTotal(data.data.total);
          setTotalSessions(data.data.totalSessions);
        })
        .catch(() => {
          setRows([]);
          setError("Failed to load sessions.");
        }),
    [page]),
    [page]
  );

  const systems = (u) => [...new Set((u.sessions || []).map((s) => deviceLabel(s.device)))];

  return (
    <>
      <Panel
        title="App sessions (one row per user)"
        icon={Users}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} />
            <Badge tone="cyan">{totalSessions} open tokens</Badge>
            <Badge tone="brand">{total} users</Badge>
          </div>
        }
      >
        {error ? <ErrorState message={error} onRetry={refresh} /> : !rows ? <Skeleton lines={5} /> : rows.length === 0 ? <Empty text="No active sessions right now." /> : (
          <>
            {/* ── Desktop table ── */}
            <div className="hidden overflow-x-auto md:block">
              <table className="admin-table w-full min-w-[760px]">
                <thead>
                  <tr><th>User</th><th>Systems</th><th>Refresh tokens</th><th>IPs</th><th>Last active</th><th className="text-right">Action</th></tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-200">{u.name}</div>
                            <div className="truncate text-xs text-slate-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="!text-xs">
                        <div className="max-w-[180px] space-y-0.5">
                          {systems(u).slice(0, 2).map((sys) => (
                            <div key={sys} className="truncate">{sys}</div>
                          ))}
                          {systems(u).length > 2 && <div className="text-[10px] text-slate-500">+{systems(u).length - 2} more</div>}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Badge tone={u.sessionCount > 3 ? "amber" : "cyan"}>{u.sessionCount}</Badge>
                          <span className="text-[10px] text-slate-500">{u.sessionCount === 1 ? "device" : "devices"}</span>
                        </div>
                      </td>
                      <td className="!text-xs">
                        <span className="font-mono">{u.distinctIps}</span>
                        {u.locations.length ? <span className="ml-1 text-slate-500">· {u.locations[0]}</span> : null}
                      </td>
                      <td className="whitespace-nowrap !text-xs text-slate-500">{fmtDate(u.lastActiveAt, true)}</td>
                      <td className="text-right">
                        <button
                          onClick={() => setDetail(u)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-300 transition active:scale-95 hover:bg-cyan-500/20"
                        >
                          <Eye className="h-3.5 w-3.5" /> View tokens
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ── */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {rows.map((u) => (
                <div key={u.userId} className="admin-row-card min-w-0 w-full rounded-xl border border-slate-400/10 bg-slate-900/40 p-4">
                  <div className="flex w-full min-w-0 items-center gap-3">
                    <Avatar name={u.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{u.name}</p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                    </div>
                    <Badge tone={u.sessionCount > 3 ? "amber" : "cyan"}>{u.sessionCount} tokens</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span>{u.distinctDevices} system{u.distinctDevices === 1 ? "" : "s"}</span>
                    <span>·</span>
                    <span className="font-mono">{u.distinctIps} IPs</span>
                    <span>·</span>
                    <span>last {fmtDate(u.lastActiveAt)}</span>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => setDetail(u)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition active:scale-95 hover:bg-cyan-500/20"
                    >
                      <Eye className="h-3.5 w-3.5" /> View refresh tokens
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Pagination page={page} total={total} limit={25} onChange={setPage} />
          </>
        )}
      </Panel>

      {detail && <SessionsModal user={detail} onClose={() => setDetail(null)} onChanged={refresh} />}
    </>
  );
}

/* Popup card listing every refresh token (session) for one user. */
function SessionsModal({ user, onClose, onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);

  const close = () => {
    setBusyId(null);
    onClose();
  };

  const revokeOne = async (s) => {
    setBusyId(s.sessionId);
    try {
      const res = await client.delete(`/api/admin/users/${user.userId}/sessions/${s.sessionId}`);
      toast.success(res.data.message || "Session revoked");
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not revoke session");
    } finally {
      setBusyId(null);
    }
  };

  const signOutAll = async () => {
    if (!confirmAll) { setConfirmAll(true); return; }
    setBusyId("all");
    try {
      const { data } = await client.delete(`/api/admin/users/${user.userId}/sessions`);
      toast.success(data.message || "Signed out everywhere");
      onChanged();
      close();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not sign out");
    } finally {
      setBusyId(null);
      setConfirmAll(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
      <div className="animate-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="admin-glass animate-modal-sheet relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-400/10 p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={user.name} size="lg" />
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-white">{user.name}</h3>
              <p className="truncate text-xs text-slate-500">{user.email}{user.phone ? ` · ${user.phone}` : ""}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone="cyan">{user.sessionCount} refresh tokens</Badge>
            <button onClick={close} className="rounded-lg p-1 text-slate-500 transition hover:bg-white/5 hover:text-white" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          <p className="text-[11px] text-slate-500">
            Every refresh token is one logged-in device/session. Shows the system, the IP, when it signed in and when its token was last refreshed.
          </p>
          {user.sessions.length === 0 ? (
            <Empty text="No active refresh tokens for this user." />
          ) : (
            user.sessions.map((s) => (
              <div key={s.sessionId} className="admin-row-card rounded-xl border border-slate-400/10 bg-slate-900/40 p-4">
                <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <MonitorSmartphone className="h-4 w-4 shrink-0 text-cyan-400" />
                    <span className="truncate text-sm font-bold text-slate-100">{deviceLabel(s.device)}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.rememberMe && <Badge tone="amber">remembered</Badge>}
                    <button
                      onClick={() => revokeOne(s)}
                      disabled={busyId === s.sessionId}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition active:scale-95 hover:bg-rose-500/20 disabled:opacity-40"
                    >
                      {busyId === s.sessionId ? <SpinnerSm /> : <LogOut className="h-3 w-3" />} Revoke
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-slate-400 sm:grid-cols-2">
                  <span className="truncate font-mono">{s.ip}{s.location ? ` · ${s.location}` : ""}</span>
                  <span className="truncate text-slate-500">{s.device}</span>
                  <span className="flex items-center gap-1.5 truncate sm:col-span-2">
                    <Clock className="h-3 w-3 shrink-0 text-slate-600" />
                    Signed in {fmtDate(s.signedInAt, true)} · Last refresh {fmtDate(s.lastUsedAt, true)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-400/10 p-4 sm:p-5">
          <p className="text-[11px] italic text-slate-500">Revoked tokens are blacklisted — that device must log in again.</p>
          <button
            onClick={signOutAll}
            disabled={busyId === "all" || user.sessions.length === 0}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-40 ${
              confirmAll ? "border-rose-500/40 bg-rose-500/25 text-rose-200" : "border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
            }`}
          >
            {busyId === "all" ? <SpinnerSm /> : <LogOut className="h-3.5 w-3.5" />}
            {confirmAll ? "Tap again to confirm" : "Sign out of all devices"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SpinnerSm() {
  return <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

/* ---------------- Failed attempts ---------------- */
function FailedTab() {
  const { data, loaded, refreshing, lastUpdated, refresh } = usePoll(
    useCallback(() => client.get("/api/admin/login-history/failed").then((r) => r.data.data), []),
    []
  );

  if (!loaded && !data) return <Skeleton lines={4} />;

  const grouped = (list, key, sub) =>
    (list || []).map((g) => ({ key: g[key], count: g.count, lastAt: g.lastAt, ips: g.ips, sub }));
  const ipRows = grouped(data?.byIp, "_id");
  const userRows = grouped(data?.byUser, "user", "email");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} />
          <button onClick={refresh} className="admin-btn-ghost" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="By IP — brute-force patterns" icon={Gauge}
          action={<Badge tone={ipRows.length ? "amber" : "green"}>{ipRows.length} groups</Badge>}>
          {ipRows.length === 0 ? <Empty /> : (
            <ul className="space-y-2">
              {ipRows.map((g) => (
                <li key={g.key} className="admin-row-card flex items-center justify-between gap-3 rounded-xl border border-slate-400/10 bg-slate-900/30 px-4 py-3 hover:border-slate-400/30">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-mono text-sm"><Fingerprint className="h-3.5 w-3.5 shrink-0 text-cyan-400" />{g.key}</div>
                    <div className="text-[11px] text-slate-500">last {fmtDate(g.lastAt, true)}</div>
                  </div>
                  <Badge tone={g.count > 10 ? "red" : g.count > 5 ? "amber" : "slate"}>{g.count} attempts</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="By user" icon={Users}
          action={<Badge tone={userRows.length ? "amber" : "green"}>{userRows.length} targets</Badge>}>
          {userRows.length === 0 ? <Empty /> : (
            <ul className="space-y-2">
              {userRows.map((g) => (
                <li key={String(g.key?._id || g.key)} className="admin-row-card flex items-center justify-between gap-3 rounded-xl border border-slate-400/10 bg-slate-900/30 px-4 py-3 hover:border-slate-400/30">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-300">{g.key?.email || g.sub || "Unknown user"}</div>
                    <div className="text-[11px] text-slate-500">{g.ips?.length || 0} IPs · last {fmtDate(g.lastAt)}</div>
                  </div>
                  <Badge tone={g.count > 10 ? "red" : g.count > 5 ? "amber" : "slate"}>{g.count} attempts</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Rate limits ---------------- */
function RateLimitsTab() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);

  const { refreshing, lastUpdated, refresh } = usePoll(
    useCallback(() =>
      client.get("/api/admin/stats/rate-limits", { params: { page, limit: 20 } })
        .then(({ data }) => setData(data.data))
        .catch(() => setData(null)),
    [page]),
    [page]
  );

  return (
    <Panel title="Rate-limit hits" icon={Gauge}
      action={
        <div className="flex items-center gap-2">
          <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} />
          <button onClick={refresh} className="admin-btn-ghost" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      }>
      {!data ? <Skeleton lines={4} /> : (
        <>
          {data.byLimiter && Object.keys(data.byLimiter).length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(data.byLimiter).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300"><ServerCog className="h-3 w-3" />{k}</span>
                  <Badge tone="amber">{v}</Badge>
                </div>
              ))}
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
  const { data, loaded, refreshing, lastUpdated } = usePoll(
    useCallback(() =>
      Promise.all([
        client.get("/api/admin/login-history/failed").then((r) => r.data.data),
        client.get("/api/admin/login-history", { params: { status: "failed", limit: 15 } }).then((r) => r.data.data),
      ]).then(([failures, recent]) => ({ failures, recent: recent.events })),
    []),
    []
  );

  if (!loaded && !data) return <Skeleton lines={4} />;

  const highIp = (data?.failures?.byIp || []).filter((g) => g.count >= 10);
  const mediumIp = (data?.failures?.byIp || []).filter((g) => g.count >= 5 && g.count < 10);
  const highUser = (data?.failures?.byUser || []).filter((g) => g.count >= 10);

  const riskCount = highIp.length + highUser.length;

  return (
    <div className="space-y-5">
      <Panel title="Suspicious login alerts" icon={AlertTriangle}
        action={
          <div className="flex items-center gap-2">
            <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} />
            <Badge tone={riskCount > 0 ? "red" : "green"}>{riskCount} high-risk patterns</Badge>
          </div>
        }>
        {highIp.length === 0 && mediumIp.length === 0 && highUser.length === 0 ? (
          <Empty text="No suspicious patterns detected right now." />
        ) : (
          <ul className="space-y-2.5">
            {highIp.map((g) => (
              <li key={g._id} className="admin-row-card flex items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 hover:bg-rose-500/15">
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold text-rose-200"><Lock className="h-3.5 w-3.5" />Brute-force pattern from {g._id}</p>
                  <p className="text-[11px] text-rose-300/70">{g.count} failed attempts · last {fmtDate(g.lastAt, true)}</p>
                </div>
                <Badge tone="red">HIGH</Badge>
              </li>
            ))}
            {highUser.map((g) => (
              <li key={String(g.user?._id || g._id)} className="admin-row-card flex items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 hover:bg-rose-500/15">
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold text-rose-200"><Fingerprint className="h-3.5 w-3.5" />{g.user?.email || "Unknown user"} under attack</p>
                  <p className="text-[11px] text-rose-300/70">{g.count} failed attempts from {g.ips?.length || 0} IPs</p>
                </div>
                <Badge tone="red">HIGH</Badge>
              </li>
            ))}
            {mediumIp.map((g) => (
              <li key={g._id} className="admin-row-card flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 hover:bg-amber-500/15">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-200"><Fingerprint className="h-3.5 w-3.5" />Repeated failures from {g._id}</p>
                  <p className="text-[11px] text-amber-300/70">{g.count} attempts · last {fmtDate(g.lastAt, true)}</p>
                </div>
                <Badge tone="amber">MEDIUM</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Recent failed logins" icon={Activity}>
        {(data?.recent || []).length === 0 ? <Empty text="No failed logins recorded." /> : (
          <ul className="space-y-2">
            {(data?.recent || []).map((e) => (
              <li key={e._id} className="admin-row-card flex items-center justify-between gap-3 rounded-xl border border-slate-400/10 bg-slate-900/30 px-4 py-2.5 text-sm hover:border-slate-400/30">
                <div className="min-w-0">
                  <span className="truncate font-mono text-xs">{e.userInfo?.email || e.emailOrPhone || "unknown"}</span>
                  <span className="text-[11px] text-slate-500"> · {e.ip}</span>
                </div>
                <span className="shrink-0 text-[11px] text-slate-500">{fmtDate(e.createdAt, true)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
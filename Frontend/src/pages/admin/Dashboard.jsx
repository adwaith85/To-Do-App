/**
 * Admin Dashboard — system overview.
 *
 * - Metric cards with honest ↑/↓ trend chips (today vs yesterday).
 * - recharts visuals: signups area chart, login success/fail trend, todos
 *   by status donut + priority bars.
 * - Auto-refreshes every 30s via the shared usePoll hook; shows a green
 *   live indicator, skeleton loaders, smooth staggered entrance and a
 *   rotating heartbeat animation on refresh so the numbers always feel live.
 */
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Users, KeyRound, ListChecks, ShieldAlert, Activity, Database, Timer, Zap,
  RefreshCw, MailCheck, MailX,
} from "lucide-react";
import client from "../../api/client";
import Spinner from "../../components/Spinner";
import {
  Panel, PageHeader, Badge, Empty, Skeleton, LiveIndicator,
} from "../../components/admin/ui";
import usePoll from "../../components/admin/usePoll";

const STATUS_COLORS = {
  pending: "#60a5fa",
  in_progress: "#fbbf24",
  completed: "#34d399",
};

const CHART_TICK = { fill: "#64748b", fontSize: 11 };

function fmtUptime(sec) {
  if (!sec) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-400/20 bg-slate-950/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-bold text-white">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="capitalize">{p.name}:</span>
          <b>{p.value}</b>
        </p>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const overviewPoll = usePoll(
    () => client.get("/api/admin/stats/overview").then((r) => r.data.data),
    []
  );
  const signupsPoll = usePoll(
    () => client.get("/api/admin/stats/signups", {
      params: {
        granularity: "day",
        from: new Date(Date.now() - 90 * 86400e3).toISOString(),
        to: new Date().toISOString(),
      },
    }).then((r) => r.data.data),
    []
  );
  const loginPoll = usePoll(
    () => client.get("/api/admin/stats/login-trend", { params: { days: 14 } }).then((r) => r.data.data),
    []
  );
  const todosPoll = usePoll(
    () => client.get("/api/admin/todos/stats").then((r) => r.data.data),
    []
  );

  const { data: overview, loaded, refreshing, lastUpdated, refresh } = overviewPoll;
  const { data: signups } = signupsPoll;
  const { data: loginTrend } = loginPoll;
  const { data: todoStats } = todosPoll;

  const buckets = (signups?.points || []).map((p) => ({ ...p, ts: new Date(p.bucket).getTime() }));
  const newToday = buckets.slice(-2)[1]?.count ?? 0;

  const pieData = Object.entries(todoStats?.byStatus || {}).map(([k, v]) => ({
    key: k, name: k.replace("_", " "), value: v,
  }));
  const statusTotal = pieData.reduce((s, d) => s + d.value, 0);
  const todayStr = new Date().toDateString();

  const loading = !loaded && !overview;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System overview"
        subtitle={`Live snapshot · updates every 30s · ${todayStr}`}
        icon={Activity}
        action={
          <div className="flex items-center gap-2">
            <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} />
            <button
              onClick={refresh}
              className="admin-btn-secondary !px-2.5 !py-1.5 text-xs"
              title="Refresh now"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
      />

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card icon={Users} label="Total users" value={overview?.users?.total ?? "…"}
          trend={overview?.deltas?.users} hint={`${newToday} signed up today`} />
        <Card icon={KeyRound} label="Login events today" value={overview?.todays?.loginEvents ?? "…"}
          trend={overview?.deltas?.logins} hint={`${overview?.todays?.failedLogins ?? 0} failed`} />
        <Card icon={ListChecks} label="Todos created today" value={overview?.todays?.todosCreated ?? "…"}
          trend={overview?.deltas?.todos} hint={`${overview?.todos ?? 0} active total`} />
        <Card icon={ShieldAlert} label="Failed logins today" value={overview?.todays?.failedLogins ?? "…"}
          trend={overview?.deltas?.failedLogins} hint="account lock-outs watch" danger />
      </div>

      {/* ── User breakdown mini-stat row ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Verified users" value={overview?.users?.verified ?? "…"} icon={MailCheck} tone="text-emerald-400" />
        <MiniStat label="Unverified" value={overview?.users?.unverified ?? "…"} icon={MailX} tone="text-amber-400" />
        <MiniStat label="Admins" value={overview?.users?.admins ?? "…"} icon={ShieldAlert} tone="text-violet-300" />
        <MiniStat label="Deactivated" value={overview?.users?.deactivated ?? "…"} icon={ShieldAlert} tone="text-rose-400" />
      </div>

      {/* ── Charts row ── */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="New signups" icon={Users} className="xl:col-span-2">
          {loading ? <Skeleton lines={4} /> : !signups || !signups.points.length ? (
            <Empty text="No signups in range yet." />
          ) : (
            <div className="h-64 transition-all duration-300">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={signups.points} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="bucket" tick={CHART_TICK} tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2.5} fill="url(#signupFill)" name="signups" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Login success / fail trend" icon={KeyRound}>
          {loading ? <Skeleton lines={4} /> : !loginTrend || !loginTrend.points.length ? (
            <Empty text="No login events recorded." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={loginTrend.points} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="bucket" tick={CHART_TICK} tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Line type="monotone" dataKey="success" name="success" stroke="#34d399" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="failed" name="failed" stroke="#fb7185" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Todos by status" icon={ListChecks}>
          {loading ? <Skeleton lines={3} /> : statusTotal === 0 ? <Empty text="No todos yet." /> : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="transparent">
                      {pieData.map((d) => <Cell key={d.key} fill={STATUS_COLORS[d.key] || "#94a3b8"} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                    <Legend formatter={(v) => <span className="text-xs text-slate-400 capitalize">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {pieData.map((d) => (
                  <Badge key={d.key} tone={d.key === "completed" ? "green" : d.key === "in_progress" ? "amber" : "cyan"}>
                    {d.name}: {d.value}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="System health" icon={Database}>
          {loading ? <Skeleton lines={4} /> : (
            <div className="space-y-2.5">
              {[
                { k: "MongoDB", v: overview?.dbConnected ? "Connected" : "Down", tone: overview?.dbConnected ? "green" : "red", icon: Database },
                { k: "Server uptime", v: fmtUptime(overview?.uptime), tone: "brand", icon: Timer },
                { k: "Active sessions", v: overview?.activeSessions ?? 0, tone: "cyan", icon: KeyRound },
                { k: "OTP requests today", v: overview?.todays?.otpRequests ?? 0, tone: "amber", icon: Zap },
              ].map((row) => (
                <div key={row.k} className="flex items-center justify-between rounded-xl border border-slate-400/10 bg-slate-900/30 px-4 py-3 hover:border-slate-400/25">
                  <span className="flex items-center gap-2 text-sm text-slate-300"><row.icon className="h-4 w-4 text-slate-500" />{row.k}</span>
                  <Badge tone={row.tone}>{row.v}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Todo volume by priority" icon={ListChecks}>
          {loading ? <Skeleton lines={3} /> : <PriorityBars data={todoStats?.byPriority || {}} />}
        </Panel>
      </div>
    </div>
  );
}

/** Big metric card with ↑/↓ trend chip + staggered entrance animation. */
function Card({ icon, label, value, trend, hint, danger }) {
  const Icon = icon;
  const isGood = trend > 0;
  const isBad = trend < 0;
  return (
    <div className="admin-glass admin-glass-hover animate-stagger relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border border-slate-400/15 bg-slate-900/50 transition-transform duration-300 ${danger ? "text-rose-400" : "text-cyan-300"}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <p className={`mt-2 text-3xl font-black tracking-tight ${danger ? "text-rose-400" : "text-white"}`}>{value ?? "—"}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {trend !== undefined && (
          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
            isGood ? "bg-emerald-500/10 text-emerald-400" : isBad ? "bg-rose-500/10 text-rose-400" : "bg-slate-500/10 text-slate-400"
          }`}>
            <svg viewBox="0 0 20 20" className={`h-3 w-3 ${isBad ? "rotate-180" : ""}`} fill="currentColor">
              <path d="M10 4l6 8H4l6-8z" />
            </svg>
            {Math.abs(trend)}%
          </span>
        )}
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon, tone }) {
  const Icon = icon;
  return (
    <div className="admin-glass animate-stagger flex items-center gap-3 p-4">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-400/15 bg-slate-900/50 ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className={`text-xl font-black leading-tight ${tone}`}>{value ?? "—"}</p>
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function PriorityBars({ data }) {
  const entries = Object.entries(data || {});
  if (!entries.length) return <Empty text="No todos yet." />;
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="space-y-4">
      {entries.map(([k, v]) => (
        <div key={k}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-semibold capitalize text-slate-300">{k}</span>
            <span className="text-slate-500">{v}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-800/60">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-700" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
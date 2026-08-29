/**
 * Admin Dashboard — system overview.
 *
 * - Metric cards with honest ↑/↓ trend chips (today vs yesterday) computed
 *   from the API's `deltas`.
 * - recharts visuals: signups area chart, login success/fail trend, todos
 *   by status donut.
 * - Polls the lightweight overview + trend endpoints every 30s so the
 *   numbers feel live without a websocket.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Users, KeyRound, ListChecks, ShieldAlert, Activity, Database, Timer, Zap,
} from "lucide-react";
import client from "../../api/client";
import Spinner from "../../components/Spinner";
import { Panel, PageHeader, Badge, Empty } from "../../components/admin/ui";

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

/** Generic 30-second polling wrapper. */
function usePoll(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const d = await fetcher();
      if (alive.current) setData(d);
    } catch { /* keep last good data on transient failures */ }
    finally { if (alive.current) setLoaded(true); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    alive.current = true;
    load();
    const t = setInterval(load, 30_000);
    return () => { alive.current = false; clearInterval(t); };
  }, [load]);

  return { data, loaded };
}

export default function AdminDashboard() {
  const { data: overview, loaded } = usePoll(
    () => client.get("/api/admin/stats/overview").then((r) => r.data.data),
    []
  );
  const { data: signups } = usePoll(
    () => client.get("/api/admin/stats/signups", { params: { granularity: "day", from: new Date(Date.now() - 90 * 86400e3).toISOString(), to: new Date().toISOString() } }).then((r) => r.data.data),
    []
  );
  const { data: loginTrend } = usePoll(
    () => client.get("/api/admin/stats/login-trend", { params: { days: 14 } }).then((r) => r.data.data),
    []
  );
  const { data: todoStats } = usePoll(
    () => client.get("/api/admin/todos/stats").then((r) => r.data.data),
    []
  );

  if (!loaded && !overview) return <Spinner label="Loading dashboard…" />;

  // Real per-day signup numbers for the trend chips.
  const buckets = (signups?.points || []).map((p) => ({ ...p, ts: new Date(p.bucket).getTime() }));
  const pointsByDay = buckets.length ? buckets.slice(-2) : [];
  const newToday = pointsByDay[1]?.count ?? 0;

  const pieData = Object.entries(todoStats?.byStatus || {}).map(([k, v]) => ({
    key: k, name: k.replace("_", " "), value: v,
  }));
  const statusTotal = pieData.reduce((s, d) => s + d.value, 0);

  const todayStr = new Date().toDateString();

  return (
    <div className="space-y-6">
      <PageHeader
        title="System overview"
        subtitle={`Live snapshot · updated every 30 seconds · ${todayStr}`}
        icon={Activity}
        action={<Badge tone="green" dot>connected</Badge>}
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

      {/* ── Charts row ── */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="New signups" icon={Users} className="xl:col-span-2">
          {!signups || !signups.points.length ? <Empty text="No signups in range yet." /> : (
            <div className="h-64">
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
          {!loginTrend || !loginTrend.points.length ? <Empty text="No login events recorded." /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={loginTrend.points} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="bucket" tick={CHART_TICK} tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Line type="monotone" dataKey="success" name="success" stroke="#34d399" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="failed" name="failed" stroke="#fb7185" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Todos by status" icon={ListChecks}>
          {statusTotal === 0 ? <Empty text="No todos yet." /> : (
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
          <div className="space-y-2.5">
            {[
              { k: "MongoDB", v: overview?.dbConnected ? "Connected" : "Down", tone: overview?.dbConnected ? "green" : "red", icon: Database },
              { k: "Server uptime", v: fmtUptime(overview?.uptime), tone: "brand", icon: Timer },
              { k: "Active sessions", v: overview?.activeSessions ?? 0, tone: "cyan", icon: KeyRound },
              { k: "OTP requests today", v: overview?.todays?.otpRequests ?? 0, tone: "amber", icon: Zap },
            ].map((row) => (
              <div key={row.k} className="flex items-center justify-between rounded-xl border border-slate-400/10 bg-slate-900/30 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-slate-300"><row.icon className="h-4 w-4 text-slate-500" />{row.k}</span>
                <Badge tone={row.tone}>{row.v}</Badge>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Todo volume by priority" icon={ListChecks}>
          <PriorityBars data={todoStats?.byPriority || {}} />
        </Panel>
      </div>
    </div>
  );
}

/** Thin wrapper so StatCard-style trend chips + icons render cleanly. */
function Card({ icon, label, value, trend, hint, danger }) {
  const Icon = icon;
  const isGood = trend > 0;
  const isBad = trend < 0;
  return (
    <div className="admin-glass admin-glass-hover relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-400/15 bg-slate-900/50 text-cyan-300">
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
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
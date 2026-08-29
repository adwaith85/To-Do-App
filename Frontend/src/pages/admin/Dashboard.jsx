/**
 * Admin Dashboard — Section D system overview.
 * Shows user totals, todo count, today's activity and uptime, plus a
 * signups-over-time chart and OTP usage summary from the admin APIs.
 */
import { useEffect, useState } from "react";
import client from "../../api/client";
import Spinner from "../../components/Spinner";
import { StatCard, Panel, Badge, Empty } from "../../components/admin/ui";

function fmtUptime(sec) {
  if (!sec) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [signups, setSignups] = useState(null);
  const [otp, setOtp] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      client.get("/api/admin/stats/overview"),
      client.get("/api/admin/stats/signups", {
        params: { granularity: "day" },
      }),
      client.get("/api/admin/stats/otp-usage"),
    ])
      .then(([o, s, oo]) => {
        if (!alive) return;
        setOverview(o.data.data);
        setSignups(s.data.data);
        setOtp(oo.data.data);
      })
      .catch(() => alive && setError("Could not load dashboard. Check that you are signed in as an admin."));
    return () => {
      alive = false;
    };
  }, []);

  if (!overview && !error) return <Spinner label="Loading dashboard..." />;

  const maxSignup = Math.max(1, ...(signups?.points || []).map((p) => p.count));

  return (
    <div className="space-y-6">
      {error && <div className="alert-error">⚠ {error}</div>}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total users" value={overview?.users?.total ?? "…"} hint={`${overview?.users?.admins ?? 0} admins`} icon="👥" />
        <StatCard label="Verified" value={overview?.users?.verified ?? "…"} hint={`${overview?.users?.unverified ?? 0} unverified`} tone="text-emerald-400" icon="📧" />
        <StatCard label="Locked / off" value={overview?.users?.locked ?? "…"} hint={`${overview?.users?.deactivated ?? 0} deactivated`} tone="text-rose-400" icon="🔒" />
        <StatCard label="Active todos" value={overview?.todos ?? "…"} hint={`${overview?.todays?.loginEvents ?? 0} logins today`} tone="text-accent-400" icon="✅" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Signups over time */}
        <Panel title="New signups (last 90 days)">
          {!signups || signups.points.length === 0 ? (
            <Empty text="No signups in range yet." />
          ) : (
            <div className="flex h-40 items-end gap-1">
              {signups.points.map((p) => (
                <div key={p.bucket} className="group relative flex-1" title={`${p.bucket}: ${p.count}`}>
                  <div
                    className="rounded-t bg-gradient-to-t from-brand-600 to-accent-400"
                    style={{ height: `${(p.count / maxSignup) * 100}%`, minHeight: 2 }}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
            <Badge tone="cyan">{signups?.granularity ?? "day"}</Badge>
            <span>{signups?.points?.length ?? 0} buckets</span>
          </div>
        </Panel>

        {/* System health */}
        <Panel title="System health">
          <div className="space-y-3">
            {[
              { k: "MongoDB", v: overview?.dbConnected ? "Connected" : "—", tone: overview?.dbConnected ? "green" : "red" },
              { k: "Server uptime", v: fmtUptime(overview?.uptime), tone: "brand" },
              { k: "Today's login events", v: overview?.todays?.loginEvents ?? 0, tone: "slate" },
              { k: "Today's OTP requests", v: overview?.todays?.otpRequests ?? 0, tone: "amber" },
              { k: "Rate-limit hits today", v: "see Security tab", tone: "slate" },
            ].map((row) => (
              <div key={row.k} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                <span className="text-sm text-slate-400">{row.k}</span>
                <Badge tone={row.tone}>{row.v}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* OTP usage summary */}
      <Panel title="OTP usage (all time)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Issued" value={otp?.issued ?? "…"} tone="text-brand-300" />
          <StatCard label="Verified" value={otp?.verified ?? "…"} tone="text-emerald-400" />
          <StatCard label="Unused" value={otp?.unverified ?? "…"} tone="text-amber-400" />
          <StatCard label="Total rows" value={otp?.total ?? "…"} tone="text-slate-300" />
        </div>
        {otp?.byType && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(otp.byType).map(([t, c]) => (
              <Badge key={t} tone="brand">{t}: {c}</Badge>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

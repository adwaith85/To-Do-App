/**
 * Admin Audit Log — chronological record of every privileged admin action.
 * Filters by action type; newest first. Auto-refreshes every 30s.
 */
import { useCallback, useState } from "react";
import { ScrollText, RefreshCw, Search } from "lucide-react";
import client from "../../api/client";
import Spinner from "../../components/Spinner";
import {
  Panel, PageHeader, Badge, Pagination, Empty, Avatar, Skeleton, LiveIndicator,
} from "../../components/admin/ui";
import { fmtDate } from "../../components/admin/utils";
import usePoll from "../../components/admin/usePoll";

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "lock_user", label: "Lock user" },
  { value: "unlock_user", label: "Unlock user" },
  { value: "deactivate_user", label: "Deactivate" },
  { value: "reactivate_user", label: "Reactivate" },
  { value: "force_logout_user", label: "Force logout" },
  { value: "revoke_session", label: "Revoke session" },
  { value: "restore_todo", label: "Restore todo" },
  { value: "purge_todo", label: "Purge todo" },
];

const ACTION_TONE = {
  lock_user: "red", unlock_user: "green", deactivate_user: "red",
  reactivate_user: "green", force_logout_user: "amber", revoke_session: "amber",
  restore_todo: "green", purge_todo: "red",
};

export default function AdminAudit() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");

  const { data, loaded, refreshing, lastUpdated, refresh } = usePoll(
    useCallback(() =>
      client.get("/api/admin/audit-log", { params: { page, limit: 20, action: action || undefined } })
        .then((r) => r.data.data)
        .catch(() => null),
    [page, action]),
    [page, action]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        subtitle="Every lock, deactivate, purge and revoke is attributed to the acting admin"
        icon={ScrollText}
        action={
          <div className="flex items-center gap-2">
            <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} />
            {data && <Badge tone="cyan">{data.total} events</Badge>}
          </div>
        }
      />

      <Panel
        title="Admin action history"
        icon={ScrollText}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <select className="admin-input !w-auto !py-1.5 !pl-8 cursor-pointer" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
                {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <button onClick={refresh} className="admin-btn-ghost" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        }
      >
        {!loaded && !data ? <Skeleton lines={5} /> : !data || data.events.length === 0 ? (
          <Empty text="No admin actions recorded." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="admin-table w-full min-w-[720px]">
                <thead>
                  <tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th><th>IP</th></tr>
                </thead>
                <tbody>
                  {data.events.map((e) => (
                    <tr key={e._id}>
                      <td className="!text-xs text-slate-500">{fmtDate(e.createdAt, true)}</td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={e.adminId?.name} size="sm" />
                          <div>
                            <div className="text-sm font-semibold text-slate-200">{e.adminId?.name || "Unknown"}</div>
                            <div className="text-[11px] text-slate-500">{e.adminId?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><Badge tone={ACTION_TONE[e.action] || "slate"}>{e.action}</Badge></td>
                      <td className="!text-xs">
                        <div className="font-semibold text-slate-300">{e.targetType}</div>
                        <div className="font-mono text-[10px] text-slate-500">{String(e.targetId || "—").slice(0, 18)}</div>
                      </td>
                      <td className="max-w-[200px] !text-xs text-slate-500">
                        {e.details && Object.keys(e.details).length > 0
                          ? <span className="truncate">{[Object.entries(e.details)[0]].map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ")}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="font-mono !text-xs">{e.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="grid gap-3 md:hidden">
              {data.events.map((e) => (
                <div key={e._id} className="admin-row-card rounded-xl border border-slate-400/10 bg-slate-900/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={e.adminId?.name} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{e.adminId?.name || "Unknown"}</p>
                        <p className="text-[10px] text-slate-500">{fmtDate(e.createdAt, true)} · {e.ip}</p>
                      </div>
                    </div>
                    <Badge tone={ACTION_TONE[e.action] || "slate"}>{e.action}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">{e.targetType}</span>
                    <span className="font-mono text-slate-600"> · {String(e.targetId || "—").slice(0, 18)}</span>
                  </p>
                </div>
              ))}
            </div>

            <Pagination page={page} total={data.total} limit={20} onChange={setPage} />
          </>
        )}
      </Panel>
    </div>
  );
}
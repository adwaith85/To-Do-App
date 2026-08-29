/**
 * Admin Audit Log — chronological record of every privileged admin action.
 * Filters by action type; newest first.
 */
import { useCallback, useEffect, useState } from "react";
import { ScrollText, RefreshCw } from "lucide-react";
import client from "../../api/client";
import Spinner from "../../components/Spinner";
import {
  Panel, PageHeader, Badge, Pagination, Empty, Avatar,
} from "../../components/admin/ui";
import { fmtDate } from "../../components/admin/utils";

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
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");

  const load = useCallback(() => {
    client.get("/api/admin/audit-log", { params: { page, limit: 20, action: action || undefined } })
      .then(({ data }) => setData(data.data))
      .catch(() => setData(null));
  }, [page, action]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        subtitle="Every lock, deactivate, purge and revoke is attributed to the acting admin"
        icon={ScrollText}
        action={data && <Badge tone="cyan">{data.total} events</Badge>}
      />

      <Panel
        title="Admin action history"
        icon={ScrollText}
        action={
          <div className="flex items-center gap-2">
            <select className="admin-input !w-auto !py-1.5 cursor-pointer" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={load} className="admin-btn-ghost" title="Refresh"><RefreshCw className="h-4 w-4" /></button>
          </div>
        }
      >
        {!data ? <Spinner label="Loading audit log…" /> : data.events.length === 0 ? <Empty text="No admin actions recorded." /> : (
          <>
            <div className="overflow-x-auto">
              <table className="admin-table w-full min-w-[680px]">
                <thead>
                  <tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>IP</th></tr>
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
                      <td className="font-mono !text-xs">{e.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={data.total} limit={20} onChange={setPage} />
          </>
        )}
      </Panel>
    </div>
  );
}
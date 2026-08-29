/**
 * Admin Audit Log — Section E: every admin action, newest first.
 */
import { useEffect, useState } from "react";
import client from "../../api/client";
import Spinner from "../../components/Spinner";
import { Panel, Badge, Pagination, Empty } from "../../components/admin/ui";

function fmt(iso) { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

const actionTone = {
  lock_user: "red", unlock_user: "green", deactivate_user: "red",
  reactivate_user: "green", force_logout_user: "amber",
  restore_todo: "green", purge_todo: "red",
};

export default function AdminAudit() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");

  useEffect(() => {
    client.get("/api/admin/audit-log", { params: { page, limit: 20, action: action || undefined } })
      .then(({ data }) => setData(data.data))
      .catch(() => setData(null));
  }, [page, action]);

  return (
    <Panel
      title="Admin audit log"
      action={
        <select className="input-field !w-auto !py-1.5 cursor-pointer" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">All actions</option>
          <option value="lock_user">Lock user</option>
          <option value="unlock_user">Unlock user</option>
          <option value="deactivate_user">Deactivate</option>
          <option value="reactivate_user">Reactivate</option>
          <option value="force_logout_user">Force logout</option>
          <option value="restore_todo">Restore todo</option>
          <option value="purge_todo">Purge todo</option>
        </select>
      }
    >
      {!data ? <Spinner label="Loading audit log…" /> : data.events.length === 0 ? <Empty /> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">When</th>
                  <th className="pb-2 pr-3 font-semibold">Admin</th>
                  <th className="pb-2 pr-3 font-semibold">Action</th>
                  <th className="pb-2 pr-3 font-semibold">Target</th>
                  <th className="pb-2 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e._id} className="border-b border-white/5">
                    <td className="py-2.5 pr-3 text-xs text-slate-500">{fmt(e.createdAt)}</td>
                    <td className="py-2.5 pr-3 text-xs font-medium">{e.adminId?.email || e.adminId?.name || "—"}</td>
                    <td className="py-2.5 pr-3"><Badge tone={actionTone[e.action] || "slate"}>{e.action}</Badge></td>
                    <td className="py-2.5 pr-3 text-xs">
                      <div>{e.targetType}</div>
                      <div className="font-mono text-[10px] text-slate-500">{e.targetId || "—"}</div>
                    </td>
                    <td className="py-2.5 font-mono text-xs">{e.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={data.total} limit={20} onChange={setPage} />
        </>
      )}
    </Panel>
  );
}

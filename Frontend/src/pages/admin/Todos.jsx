/**
 * Admin Todos — Section C: todo activity monitoring.
 * Tabs: All Todos · Stats · Recycle Bin (restore / purge).
 */
import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import client from "../../api/client";
import Spinner from "../../components/Spinner";
import { Panel, Badge, Pagination, Empty } from "../../components/admin/ui";

const TABS = [
  { id: "all", label: "All Todos" },
  { id: "stats", label: "Stats" },
  { id: "deleted", label: "Recycle Bin" },
];

function fmt(iso) { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

export default function AdminTodos() {
  const [tab, setTab] = useState("all");
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
      {tab === "all" && <AllTodos />}
      {tab === "stats" && <TodosStats />}
      {tab === "deleted" && <RecycleBin />}
    </div>
  );
}

function AllTodos() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    client.get("/api/admin/todos", { params: { page, limit: 15, search: search || undefined, status: status || undefined } })
      .then(({ data }) => { setRows(data.data.todos); setTotal(data.data.total); })
      .catch(() => setRows([]));
  }, [page, search, status]);

  return (
    <Panel
      title="All todos (every user)"
      action={
        <div className="flex gap-2">
          <input className="input-field !w-auto !py-1.5" placeholder="Search tasks…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className="input-field !w-auto !py-1.5 cursor-pointer" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      }
    >
      {!rows ? <Spinner label="Loading…" /> : rows.length === 0 ? <Empty /> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">Task</th>
                  <th className="pb-2 pr-3 font-semibold">Owner</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 pr-3 font-semibold">Priority</th>
                  <th className="pb-2 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t._id} className="border-b border-white/5">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{t.title || t.task}</div>
                      {t.description && <div className="max-w-xs truncate text-xs text-slate-500">{t.description}</div>}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">{t.user?.name || t.user?.email || "—"}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={t.status === "completed" ? "green" : t.status === "in_progress" ? "amber" : "slate"}>{t.status}</Badge>
                    </td>
                    <td className="py-2.5 pr-3"><Badge tone={t.priority === "high" ? "red" : t.priority === "low" ? "green" : "slate"}>{t.priority}</Badge></td>
                    <td className="py-2.5 text-xs text-slate-500">{fmt(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} limit={15} onChange={setPage} />
        </>
      )}
    </Panel>
  );
}

function TodosStats() {
  const [data, setData] = useState(null);
  useEffect(() => {
    client.get("/api/admin/todos/stats").then(({ data }) => setData(data.data)).catch(() => setData(null));
  }, []);

  if (!data) return <Spinner label="Loading stats…" />;
  const totals = data.totals || {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="Total" value={totals.total} tone="text-white" />
        <MiniStat label="Completed" value={totals.completed} tone="text-emerald-400" />
        <MiniStat label="In progress" value={totals.in_progress} tone="text-amber-400" />
        <MiniStat label="Pending" value={totals.pending} tone="text-accent-400" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="By status">
          <BarList data={data.byStatus} color="from-brand-600 to-accent-400" />
        </Panel>
        <Panel title="By priority">
          <BarList data={data.byPriority} color="from-rose-600 to-amber-400" />
        </Panel>
      </div>
      <Panel title="Most active users">
        {(data.mostActiveUsers || []).length === 0 ? <Empty /> : (
          <ul className="space-y-2">
            {data.mostActiveUsers.map((u, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2.5 text-sm">
                <div>
                  <div className="font-semibold">{u.user?.email || "Unknown user"}</div>
                  <div className="text-[11px] text-slate-500">{u.completed} completed</div>
                </div>
                <Badge tone="brand">{u.total} todos</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div className="glass-card !p-5 text-center">
      <div className={`text-3xl font-extrabold ${tone}`}>{value ?? 0}</div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function BarList({ data, color }) {
  const entries = Object.entries(data || {});
  if (entries.length === 0) return <Empty />;
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="capitalize text-slate-300">{k}</span>
            <span className="text-slate-500">{v}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
            <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecycleBin() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    client.get("/api/admin/todos/deleted", { params: { page, limit: 15 } })
      .then(({ data }) => setData(data.data))
      .catch(() => setData(null));
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const act = (id, kind, msg) => {
    setBusy(id);
    const req = kind === "restore"
      ? client.patch(`/api/admin/todos/${id}/restore`)
      : client.delete(`/api/admin/todos/${id}/purge`);
    req.then(({ data }) => { toast.success(data.message || msg); load(); })
      .catch(() => toast.error("Action failed"))
      .finally(() => setBusy(null));
  };

  if (!data) return <Spinner label="Loading recycle bin…" />;
  return (
    <Panel title="Soft-deleted todos" action={<Badge tone="cyan">{data.total} items</Badge>}>
      {data.todos.length === 0 ? <Empty text="Recycle bin is empty." /> : (
        <>
          <ul className="space-y-2">
            {data.todos.map((t) => (
              <li key={t._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{t.title || t.task}</div>
                  <div className="text-xs text-slate-500">
                    {t.user?.email || "Unknown user"} · deleted {fmt(t.updatedAt)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button disabled={busy === t._id} className="btn-secondary !py-1.5 text-xs" onClick={() => act(t._id, "restore", "Todo restored")}>Restore</button>
                  <button disabled={busy === t._id} className="btn-danger !py-1.5 text-xs" onClick={() => act(t._id, "purge", "Permanently deleted")}>Purge</button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} total={data.total} limit={15} onChange={setPage} />
        </>
      )}
    </Panel>
  );
}

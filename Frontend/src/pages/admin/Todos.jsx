/**
 * Admin Todos — todo activity monitoring.
 *
 * Tabs: All Todos (filterable) · Stats (recharts) · Recycle Bin (restore/purge).
 * - Every todo row is clickable → TodoDetailModal renders the COMPLETE
 *   database record: description, tags, due date, timestamps, reminder
 *   state, attachments, pin flag + full lifecycle history.
 * - Auto-refreshes every 30s with a live indicator.
 * - Purging is destructive → ConfirmModal + toast.
 */
import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import {
  ListTodo, Trash2, RotateCcw, Search, RefreshCw, BarChart3, Eye, Pin,
  Paperclip, Clock, Tags,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import client from "../../api/client";
import Spinner from "../../components/Spinner";
import {
  Panel, PageHeader, Badge, Pagination, Empty, ConfirmModal, Skeleton, TabButton, LiveIndicator,
} from "../../components/admin/ui";
import { fmtDate, TODO_STATUS_TONE, TODO_PRIORITY_TONE } from "../../components/admin/utils";
import usePoll from "../../components/admin/usePoll";
import TodoDetailModal from "../../components/admin/TodoDetailModal";

const STATUS_COLORS = { pending: "#60a5fa", in_progress: "#fbbf24", completed: "#34d399" };
const PRIORITY_COLORS = { high: "#fb7185", medium: "#fbbf24", low: "#34d399" };

const TABS = [
  { id: "all", label: "All Todos", icon: ListTodo },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "deleted", label: "Recycle Bin", icon: Trash2 },
];

const CHART_TICK = { fill: "#64748b", fontSize: 11 };

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-400/20 bg-slate-950/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-bold text-white">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey || p.name} className="flex items-center gap-2 text-slate-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="capitalize">{p.name}:</span><b>{p.value}</b>
        </p>
      ))}
    </div>
  );
}

export default function AdminTodos() {
  const [tab, setTab] = useState("all");
  return (
    <div className="space-y-5">
      <PageHeader title="Todos" subtitle="Track every task detail stored in the database" icon={ListTodo} />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </TabButton>
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
  const [priority, setPriority] = useState("");
  const [detail, setDetail] = useState(null);

  const { refreshing, lastUpdated, refresh } = usePoll(
    useCallback(() =>
      client.get("/api/admin/todos", {
        params: { page, limit: 15, search: search || undefined, status: status || undefined, priority: priority || undefined },
      }).then(({ data }) => { setRows(data.data.todos); setTotal(data.data.total); })
        .catch(() => setRows([])),
    [page, search, status, priority]),
    [page, search, status, priority]
  );

  return (
    <Panel
      title="All todos (every user)"
      icon={ListTodo}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input className="admin-input !w-44 !py-1.5 !pl-8 sm:!w-56" placeholder="Search tasks…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="admin-input !w-auto !py-1.5 cursor-pointer" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
          <select className="admin-input !w-auto !py-1.5 cursor-pointer" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button onClick={refresh} className="admin-btn-ghost" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      }
    >
      {!rows ? <Spinner label="Loading…" /> : rows.length === 0 ? <Empty text="No todos match these filters." /> : (
        <>
          <div className="overflow-x-auto">
            <table className="admin-table w-full min-w-[900px]">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Flags</th>
                  <th>Reminder</th>
                  <th>Created</th>
                  <th className="text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t._id} className="cursor-pointer" onClick={() => setDetail(t)}>
                    <td className="max-w-[280px]">
                      <div className="truncate font-semibold text-slate-200">{t.title || t.task}</div>
                      {t.description && <div className="max-w-[260px] truncate text-xs text-slate-500">{t.description}</div>}
                      {Array.isArray(t.tags) && t.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {t.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-0.5 rounded bg-cyan-400/10 px-1.5 py-px text-[10px] font-semibold text-cyan-300"><Tags className="h-2.5 w-2.5" />{tag}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="!text-xs">{t.user?.name || t.user?.email || "—"}</td>
                    <td><Badge tone={TODO_STATUS_TONE[t.status] || "slate"} dot>{t.status}</Badge></td>
                    <td><Badge tone={TODO_PRIORITY_TONE[t.priority] || "slate"}>{t.priority}</Badge></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {t.isPinned && <span title="Pinned"><Pin className="h-3.5 w-3.5 text-cyan-400" /></span>}
                        {t.isArchived && <Badge tone="amber">archived</Badge>}
                        {t.isDeleted && <Badge tone="red">deleted</Badge>}
                        {(!t.isPinned && !t.isArchived && !t.isDeleted) && <span className="text-[10px] text-slate-600">—</span>}
                      </div>
                    </td>
                    <td className="!text-xs">
                      {t.reminderAt ? (
                        <span className="flex items-center gap-1 text-amber-300">
                          <Clock className="h-3 w-3" />
                          <span title={`Reminder ${fmtDate(t.reminderAt, true)}`}>{t.reminderSent ? "sent" : "due soon"}</span>
                        </span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="!text-xs text-slate-500">{fmtDate(t.createdAt)}</td>
                    <td className="text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetail(t); }}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-300 transition active:scale-95 hover:bg-cyan-400/20"
                      >
                        <Eye className="h-3 w-3" /> Full record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile: card version of each todo ── */}
          <div className="grid gap-3 md:hidden">
            {rows.map((t) => (
              <button
                key={t._id}
                onClick={() => setDetail(t)}
                className="admin-row-card rounded-xl border border-slate-400/10 bg-slate-900/40 p-4 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-100">{t.title || t.task}</p>
                    <p className="truncate text-xs text-slate-500">{t.user?.name || t.user?.email}</p>
                  </div>
                  <Eye className="h-4 w-4 shrink-0 text-cyan-400" />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={TODO_STATUS_TONE[t.status] || "slate"} dot>{t.status}</Badge>
                  <Badge tone={TODO_PRIORITY_TONE[t.priority] || "slate"}>{t.priority}</Badge>
                  {t.isPinned && <Pin className="h-3.5 w-3.5 text-cyan-400" />}
                  {t.isArchived && <Badge tone="amber">archived</Badge>}
                  {t.isDeleted && <Badge tone="red">deleted</Badge>}
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  {t.dueDate && <span className="mr-2">Due {fmtDate(t.dueDate)}</span>}
                  Created {fmtDate(t.createdAt)}
                </div>
              </button>
            ))}
          </div>

          <Pagination page={page} total={total} limit={15} onChange={setPage} />
        </>
      )}

      <TodoDetailModal
        todo={detail && { ...detail, user: typeof detail.user === "object" ? detail.user : null }}
        onClose={() => setDetail(null)}
      />
    </Panel>
  );
}

function TodosStats() {
  const { data, loaded } = usePoll(
    useCallback(() => client.get("/api/admin/todos/stats").then(({ data }) => data.data), []),
    []
  );
  if (!loaded && !data) return <Spinner label="Loading stats…" />;
  const totals = data?.totals || {};
  const statusData = Object.entries(data?.byStatus || {}).map(([k, v]) => ({ name: k.replace("_", " "), value: v }));
  const priorityData = Object.entries(data?.byPriority || {}).map(([k, v]) => ({ name: k, value: v }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { l: "Total", v: totals.total, tone: "text-white" },
          { l: "Completed", v: totals.completed, tone: "text-emerald-400" },
          { l: "In progress", v: totals.in_progress, tone: "text-amber-400" },
          { l: "Pending", v: totals.pending, tone: "text-cyan-300" },
        ].map((s) => (
          <div key={s.l} className="admin-glass admin-glass-hover animate-stagger p-5 text-center" style={{ animationDelay: "0s" }}>
            <div className={`text-3xl font-black ${s.tone}`}>{s.v ?? 0}</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="By status" icon={BarChart3}>
          {statusData.length === 0 ? <Empty /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={3} stroke="transparent">
                    {statusData.map((d) => <Cell key={d.name} fill={STATUS_COLORS[d.name.replace(" ", "_")]} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                  <Legend formatter={(v) => <span className="text-xs capitalize text-slate-400">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="By priority" icon={BarChart3}>
          {priorityData.length === 0 ? <Empty /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="name" tick={CHART_TICK} tickLine={false} axisLine={false} />
                  <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
                  <Bar dataKey="value" name="todos" radius={[6, 6, 0, 0]}>
                    {priorityData.map((d) => <Cell key={d.name} fill={PRIORITY_COLORS[d.name]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Most active users" icon={ListTodo}>
        {(data?.mostActiveUsers || []).length === 0 ? <Empty /> : (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.mostActiveUsers || []).map((u, i) => (
              <div key={i} className="admin-row-card flex items-center justify-between rounded-xl border border-slate-400/10 bg-slate-900/30 px-4 py-3 hover:border-cyan-400/30">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-200">{u.user?.email || u.user?.name || "Unknown user"}</p>
                  <p className="text-[11px] text-slate-500">{u.completed} completed</p>
                </div>
                <Badge tone="cyan">{u.total} todos</Badge>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function RecycleBin() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);

  const { refreshing, lastUpdated, refresh } = usePoll(
    useCallback(() =>
      client.get("/api/admin/todos/deleted", { params: { page, limit: 15 } })
        .then(({ data }) => setData(data.data))
        .catch(() => setData(null)),
    [page]),
    [page]
  );

  const act = async (kind, msg) => {
    const todo = confirm.todo;
    setBusy(true);
    try {
      const req = kind === "restore"
        ? client.patch(`/api/admin/todos/${todo._id}/restore`)
        : client.delete(`/api/admin/todos/${todo._id}/purge`);
      const { data: res } = await req;
      toast.success(res.message || msg);
      refresh();
    } catch {
      toast.error("Action failed");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <Panel title="Soft-deleted todos (recycle bin)" icon={Trash2}
      action={
        <div className="flex items-center gap-2">
          <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} />
          <Badge tone="cyan">{data?.total ?? 0} items</Badge>
        </div>
      }>
      {!data ? <Skeleton lines={3} /> : !data.todos || data.todos.length === 0 ? <Empty text="Recycle bin is empty." /> : (
        <>
          <ul className="space-y-2">
            {data.todos.map((t) => (
              <li key={t._id} className="admin-row-card flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-400/10 bg-slate-900/30 px-4 py-3 hover:border-slate-400/30">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-200">{t.title || t.task}</p>
                  <p className="text-xs text-slate-500">{t.user?.email || "Unknown user"} · deleted {fmtDate(t.deletedAt || t.updatedAt)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDetail(t)} className="admin-btn-ghost !px-2.5 !py-1.5 text-xs" title="View full record"><Eye className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setConfirm({ todo: t, action: "restore" })} className="admin-btn-secondary !px-3 !py-1.5 text-xs"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
                  <button onClick={() => setConfirm({ todo: t, action: "purge" })} className="admin-btn-danger !px-3 !py-1.5 text-xs"><Trash2 className="h-3.5 w-3.5" /> Purge</button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} total={data.total} limit={15} onChange={setPage} />
        </>
      )}

      <TodoDetailModal
        todo={detail && { ...detail, user: typeof detail.user === "object" ? detail.user : null }}
        onClose={() => setDetail(null)}
      />

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.action === "purge" ? "Permanently delete todo" : "Restore todo"}
        message={confirm?.action === "purge"
          ? `"${(confirm?.todo?.title || confirm?.todo?.task || "").slice(0, 80)}" will be permanently erased. This cannot be undone.`
          : `Bring "${(confirm?.todo?.title || confirm?.todo?.task || "").slice(0, 80)}" back to the owner's todo list.`}
        confirmLabel={confirm?.action === "purge" ? "Purge forever" : "Restore"}
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && act(confirm.action, confirm.action === "purge" ? "Todo permanently deleted" : "Todo restored")}
      />
    </Panel>
  );
}
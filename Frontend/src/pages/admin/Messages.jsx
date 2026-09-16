/**
 * Admin Messages — public support / help-desk inbox.
 *
 * Messages arrive from the login page's "Need help?" dialog and are triaged
 * here: filter by status/category, read the full message, mark resolved,
 * leave a private admin note, or delete. Auto-refreshes every 30s.
 */
import { useCallback, useState } from "react";
import { Inbox, RefreshCw, Mail, Search } from "lucide-react";
import client from "../../api/client";
import {
  Panel, PageHeader, Skeleton, LiveIndicator, TabButton, Pagination,
} from "../../components/admin/ui";
import { StatusBadge, CategoryBadge } from "../../components/admin/badges";
import { fmtDate, deviceLabel, STATUS_TONE_MSG, CATEGORY_TONE_MSG } from "../../components/admin/utils";
import usePoll from "../../components/admin/usePoll";
import MessageDetailModal from "../../components/admin/MessageDetailModal";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "resolved", label: "Resolved" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "All topics" },
  { value: "login", label: "Login" },
  { value: "account", label: "Account" },
  { value: "bug", label: "Bug" },
  { value: "billing", label: "Billing" },
  { value: "other", label: "Other" },
];

export default function AdminMessages() {
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null); // message under review

  const { data, loaded, refreshing, lastUpdated, refresh } = usePoll(
    useCallback(() =>
      client.get("/api/admin/messages", {
        params: {
          page, limit: 20,
          status: status || undefined,
          category: category || undefined,
          search: search.trim() || undefined,
        },
      })
        .then((r) => r.data.data)
        .catch(() => null),
    [page, status, category, search]),
    [page, status, category, search]
  );

  const messages = data?.messages || [];
  const countBy = (s) => (data?.statusCounts?.[s]) ?? undefined;

  const openMessage = async (m) => {
    // Fetch the fresh record → backend flips "new" to "read" in the same call.
    try {
      const { data: res } = await client.get(`/api/admin/messages/${m._id}`);
      setSelected(res.data.message);
    } catch {
      setSelected(m);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Messages"
        subtitle="Support requests from the public login page — triage in one place"
        icon={Inbox}
        action={
          <div className="flex items-center gap-2">
            <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} />
            {data && <span className="rounded-md border border-slate-400/15 bg-slate-900/30 px-2 py-1 text-[10px] font-semibold text-slate-400">{data.total} messages</span>}
          </div>
        }
      />

      <Panel
        title="Support inbox"
        icon={Mail}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search sender or subject…"
                className="admin-input !w-52 !py-1.5 !pl-8 text-xs"
              />
            </div>
            <select
              className="admin-input !w-auto !py-1.5 cursor-pointer"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            >
              {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={refresh} className="admin-btn-ghost" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        }
      >
        {/* Status tabs */}
        <div className="mb-4 flex flex-wrap gap-1.5 border-b border-slate-400/10 pb-3">
          {STATUS_FILTERS.map((f) => (
            <TabButton
              key={f.value}
              active={status === f.value}
              onClick={() => { setStatus(f.value); setPage(1); }}
            >
              {f.label}
              {f.value && countBy(f.value) !== undefined && (
                <span className="rounded-md bg-white/10 px-1.5 text-[10px]">{countBy(f.value)}</span>
              )}
            </TabButton>
          ))}
        </div>

        {!loaded && !data ? <Skeleton lines={5} /> : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-400/15 px-6 py-12 text-center">
            <Inbox className="h-8 w-8 text-slate-600" />
            <p className="text-sm italic text-slate-500">Inbox zero — no messages matched.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="overflow-x-auto">
              <table className="admin-table w-full min-w-[760px]">
                <thead>
                  <tr><th>Status</th><th>From</th><th>Subject</th><th>Topic</th><th>Sent</th><th>Device</th></tr>
                </thead>
                <tbody>
                  {messages.map((m) => (
                    <tr key={m._id} onClick={() => openMessage(m)} className="cursor-pointer">
                      <td><StatusBadge status={m.status} /></td>
                      <td>
                        <div className="text-sm font-semibold text-slate-200">{m.name}</div>
                        <div className="text-[11px] text-slate-500">{m.email}</div>
                      </td>
                      <td className="max-w-[240px]">
                        <div className="truncate font-medium text-slate-200">{m.subject}</div>
                        <div className="truncate text-[11px] text-slate-500">{m.message}</div>
                      </td>
                      <td><CategoryBadge category={m.category} /></td>
                      <td className="whitespace-nowrap !text-xs text-slate-500">{fmtDate(m.createdAt, true)}</td>
                      <td className="max-w-[140px] truncate !text-xs text-slate-500">{deviceLabel(m.userAgent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {messages.map((m) => (
                <div key={m._id} onClick={() => openMessage(m)} className="admin-row-card cursor-pointer rounded-xl border border-slate-400/10 bg-slate-900/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-200">{m.subject}</p>
                      <p className="truncate text-[11px] text-slate-500">{m.name} · {m.email}</p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-400">{m.message}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <CategoryBadge category={m.category} />
                    <span className="text-[10px] text-slate-500">{fmtDate(m.createdAt, true)}</span>
                  </div>
                </div>
              ))}
            </div>

            <Pagination page={page} total={data.total} limit={20} onChange={setPage} />
          </>
        )}
      </Panel>

      <MessageDetailModal
        message={selected}
        onClose={() => setSelected(null)}
        onChanged={() => refresh()}
      />
    </div>
  );
}
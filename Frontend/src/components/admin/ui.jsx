/**
 * Small re-usable presentational kit for the admin console.
 *
 * Every component is kept deliberately free of data-fetching logic so the
 * pages stay readable and the styling stays consistent ("slate liquid-glass"
 * identity — see index.css .admin-*) .
 */
import { X, ArrowLeft, ArrowRight, Inbox } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */

/** Initials avatar (deterministic color per name). */
export function Avatar({ name = "", size = "md" }) {
  const initials = String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const colors = [
    "from-cyan-500/70 to-emerald-500/70",
    "from-sky-500/70 to-cyan-500/70",
    "from-emerald-500/70 to-teal-500/70",
    "from-indigo-500/70 to-sky-500/70",
    "from-teal-500/70 to-emerald-500/70",
  ];
  const idx = (String(name).length + initials.length) % colors.length;
  const cls = size === "lg" ? "h-11 w-11 text-sm" : size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${colors[idx]} font-bold text-white ${cls}`}
    >
      {initials || "?"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

const BADGE_TONES = {
  slate: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  red:   "border-rose-500/30 bg-rose-500/10 text-rose-400",
  cyan:  "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  brand: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  gray:  "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

/** Color-coded status/type chip. green=active, red=locked/off, gray=deactivated. */
export function Badge({ tone = "slate", children, dot = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold ${BADGE_TONES[tone] || BADGE_TONES.slate}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Glass panel with optional header row (title / icon / action slot). */
export function Panel({ title, icon, action, children, className = "", bodyClassName = "" }) {
  const Icon = icon;
  return (
    <section className={`admin-glass admin-glass-hover p-5 ${className}`}>
      {(title || icon || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                <Icon className="h-4 w-4" />
              </span>
            )}
            {title && (
              <h2 className="text-sm font-bold tracking-wide text-slate-200">{title}</h2>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Big-number metric card with ↑/↓ trend chip vs the previous period. */
export function StatCard({ label, value, icon, tone = "text-white", trend, hint }) {
  const Icon = icon;
  const isGood = trend > 0;
  const isBad = trend < 0;
  const flat = trend === 0;

  return (
    <div className="admin-glass admin-glass-hover relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        {Icon && <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-400/15 bg-slate-900/50 text-cyan-300"><Icon className="h-4.5 w-4.5" /></span>}
      </div>
      <p className={`mt-2 text-3xl font-black tracking-tight ${tone}`}>{value ?? "—"}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {trend !== undefined && trend !== null && (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
              isGood ? "bg-emerald-500/10 text-emerald-400"
              : isBad ? "bg-rose-500/10 text-rose-400"
              : "bg-slate-500/10 text-slate-400"
            }`}
          >
            <ArrowRight className={`h-3 w-3 ${isBad ? "rotate-90" : flat ? "" : "-rotate-90"}`} />
            {Math.abs(trend)}%
          </span>
        )}
        {(hint || trend === undefined) && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
    </div>
  );
}

/** Page heading helper (title + optional subtitle/action). */
export function PageHeader({ title, subtitle, icon, action }) {
  const Icon = icon;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
          <h1 className="text-lg font-black tracking-tight text-white">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table primitives                                                    */
/* ------------------------------------------------------------------ */

/** Sortable column header. */
export function Th({ children, sortKey, sort, onSort, className = "" }) {
  // Only try to read `sort` when this column is actually sortable — plain
  // header cells (<Th>text</Th>) must never touch `sort.dir` (guards against
  // `sort?.key === undefined` matching `sortKey === undefined`).
  const isActive = Boolean(sortKey && sort?.key === sortKey);
  const Arrow = isActive && sort?.dir === "asc" ? ArrowRight : ArrowLeft;
  return (
    <th className={className}>
      {sortKey ? (
        <button
          className={`inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-slate-300 ${isActive ? "text-cyan-300" : ""}`}
          onClick={() => onSort?.(sortKey)}
        >
          {children}
          <span className="flex h-3 w-3 items-center justify-center">
            {isActive && <Arrow className={`h-3 w-3 ${sort?.dir === "desc" ? "rotate-180" : ""}`} />}
          </span>
        </button>
      ) : children}
    </th>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination / empty states                                           */
/* ------------------------------------------------------------------ */

export function Pagination({ page, total, limit, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  const window = pages <= 5 ? [...Array(pages).keys()].map((i) => i + 1) : [];
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-slate-500">
        Page <b className="text-slate-300">{page}</b> of {pages} · {total} rows
      </span>
      <div className="flex items-center gap-1.5">
        <button
          className="admin-btn-ghost !px-2.5 !py-1.5 text-xs disabled:opacity-30"
          disabled={page <= 1}
          onClick={() => onChange(Math.max(1, page - 1))}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Prev
        </button>
        {window.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`h-8 w-8 rounded-lg text-xs font-bold transition ${
              p === page ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/40" : "text-slate-500 hover:bg-white/5 hover:text-white"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          className="admin-btn-ghost !px-2.5 !py-1.5 text-xs disabled:opacity-30"
          disabled={page >= pages}
          onClick={() => onChange(Math.min(pages, page + 1))}
        >
          Next <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Empty-state row. */
export function Empty({ text = "Nothing here yet.", icon }) {
  const Icon = icon || Inbox;
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-400/15 px-6 py-12 text-center">
      <Icon className="h-8 w-8 text-slate-600" />
      <p className="text-sm italic text-slate-500">{text}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Confirm modal (destructive actions)                                 */
/* ------------------------------------------------------------------ */

/**
 * Confirmation modal for destructive admin actions (lock, deactivate,
 * purge, force logout, revoke). Always requires an explicit click so a
 * mis-tap can't take a destructive action; every confirmed action surfaces
 * a toast in the calling page.
 */
export function ConfirmModal({ open, title, message, confirmLabel = "Confirm", tone = "danger", loading = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="admin-glass relative w-full max-w-md p-6">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="text-base font-black text-white">{title}</h3>
          <button onClick={onCancel} className="rounded-lg p-1 text-slate-500 transition hover:bg-white/5 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-slate-400">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="admin-btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className={tone === "danger" ? "admin-btn-danger" : "admin-btn-secondary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
/**
 * Small reusable presentational bits for the admin panel.
 */

/** Colored badge for a value (tone key → tailwind classes). */
export function Badge({ tone = "slate", children }) {
  const tones = {
    slate: "border-white/10 bg-white/5 text-slate-300",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    red: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    brand: "border-brand-500/30 bg-brand-500/10 text-brand-300",
    cyan: "border-accent-500/30 bg-accent-500/10 text-accent-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

/** Big number card used on the dashboard. */
export function StatCard({ label, value, hint, icon, tone = "text-white" }) {
  return (
    <div className="glass-card !p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={`mt-2 text-3xl font-extrabold ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Simple card wrapper with an optional title. */
export function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`glass-card p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Minimal pagination bar. */
export function Pagination({ page, total, limit, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="text-xs text-slate-500">
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          className="btn-secondary !py-1.5 !px-3 text-xs"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          ← Prev
        </button>
        <button
          className="btn-secondary !py-1.5 !px-3 text-xs"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

/** "…" empty state row. */
export function Empty({ text = "Nothing here yet." }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
      <p className="text-sm italic text-slate-500">{text}</p>
    </div>
  );
}

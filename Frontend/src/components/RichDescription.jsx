import { splitDescription, toggleItemAt } from "../utils/description";

/**
 * Renders a todo `description` string in the exact order it was typed.
 *
 * List lines are rendered as a row with a marking box (checkbox) — clicking it
 * marks "done" for that one item (tick + line-through) without changing the
 * card's opacity. All other non-empty lines are rendered as paragraphs.
 */
export default function RichDescription({
  description,
  light = false,
  className = "",
  textClass = "",
  onToggle,
}) {
  const segments = splitDescription(description);
  if (!segments.length) return null;

  // Precompute the global item index at the start of each list segment so we
  // never mutate state or a ref during render.
  const globalStart = [];
  let runningCount = 0;
  for (const seg of segments) {
    if (seg.type === "list") {
      globalStart.push(runningCount);
      runningCount += seg.items.length;
    } else {
      globalStart.push(null);
    }
  }

  const boxCls = (checked) =>
    `mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors ${
      checked
        ? "border-emerald-400 bg-emerald-500 text-white"
        : light
          ? "border-slate-400 text-slate-500 hover:border-brand-400 hover:text-brand-600"
          : "border-slate-400/80 text-slate-300 hover:border-brand-400 hover:text-brand-300"
    }`;

  const CheckSvg = (
    <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5" aria-hidden>
      <path d="M2 6.2 4.6 8.8 10 3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div className={`${className} space-y-2`}>
      {segments.map((seg, i) => {
        if (seg.type === "list") {
          const base = globalStart[i];
          return (
            <ul key={i} className="space-y-1">
              {seg.items.map((it, j) => {
                const idx = base + j;
                return (
                  <li key={idx} className="flex items-start gap-2">
                    {onToggle ? (
                      <button
                        type="button"
                        aria-label={it.checked ? "Mark list item not done" : "Mark list item done"}
                        onClick={() => onToggle(toggleItemAt(description, idx), it.checked)}
                        className={boxCls(it.checked)}
                      >
                        {it.checked && CheckSvg}
                      </button>
                    ) : (
                      <span className={boxCls(it.checked)}>
                        {it.checked && CheckSvg}
                      </span>
                    )}
                    <span
                      className={`min-w-0 flex-1 break-words ${
                        it.checked ? "line-through" : ""
                      } ${textClass}`}
                    >
                      {it.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }
        return (
          <p key={i} className={`min-w-0 break-words ${textClass}`}>
            {seg.text}
          </p>
        );
      })}
    </div>
  );
}
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { isListLine, toListLine, fromListLine } from "../utils/description";

/**
 * Description editor with two modes:
 *  - paragraph : renders any persisted list as diamond bullets (read-only) plus
 *    an editable textarea for the continuing paragraph text.
 *  - list      : diamond bullet items; Enter adds the next item, Enter on an
 *    empty item finishes the list and continues as a paragraph below it.
 *
 * List items are persisted in the description string with the `• ` line prefix
 * (see RichDescription), so the diamonds survive returning to paragraph mode,
 * are saved to the database, and are re-rendered on the todo cards.
 */
const ListEditor = forwardRef(function ListEditor(
  { value = "", onChange, placeholder = "Add a note...", light = false },
  ref
) {
  const [mode, setMode] = useState("paragraph");
  const paraRef = useRef(null);
  const itemRefs = useRef([]);

  const lines = value.split("\n");
  const itemLines = lines.filter(isListLine);
  const items = itemLines.map(fromListLine);
  const prefixText = lines.filter((l) => !isListLine(l)).join("\n").trim();

  const focusParagraphAtEnd = () => {
    const el = paraRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    try { el.setSelectionRange(len, len); } catch { /* noop */ }
  };

  const startList = () => {
    let base = value.trimEnd();
    // Keep any paragraph text above the list; start on a fresh line.
    if (base && !base.endsWith("\n")) base = `${base}\n`;
    const next = base ? `${base}${toListLine("")}` : toListLine("");
    if (next !== value) onChange(next);
    setMode("list");
    requestAnimationFrame(() => {
      const count = next.split("\n").filter(isListLine).length;
      itemRefs.current[Math.max(0, count - 1)]?.focus();
    });
  };

  const finishList = () => {
    // Keep the typed list (markers included), drop trailing empty lines and
    // empty list items, then separate the continuing paragraph with a blank line.
    const kept = value.split("\n");
    while (kept.length) {
      const last = kept[kept.length - 1];
      if (last.trim() === "") { kept.pop(); continue; }
      if (isListLine(last) && fromListLine(last).trim() === "") { kept.pop(); continue; }
      break;
    }
    let base = kept.join("\n");
    if (base) base = `${base}\n\n`;
    if (base !== value) onChange(base);
    setMode("paragraph");
    requestAnimationFrame(focusParagraphAtEnd);
  };

  useImperativeHandle(ref, () => ({ startList }));

  // Rewrites only the list-item lines, preserving any surrounding paragraph text.
  const rebuild = (nextItems) => {
    const out = lines.map((l) => (isListLine(l) ? toListLine(nextItems.shift() ?? "") : l));
    if (nextItems.length) out.push(...nextItems.map(toListLine));
    onChange(out.join("\n"));
  };

  const onItemChange = (idx, text) => {
    const next = [...items];
    next[idx] = text;
    rebuild(next);
  };

  const onItemKeyDown = (e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const currentIsEmpty = (items[idx] || "").trim() === "";
      if (currentIsEmpty) {
        finishList();
        return;
      }
      const next = [...items];
      next.splice(idx + 1, 0, "");
      rebuild(next);
      requestAnimationFrame(() => itemRefs.current[idx + 1]?.focus());
    } else if (e.key === "Backspace" && (items[idx] || "").length === 0 && items.length > 1) {
      e.preventDefault();
      const next = [...items];
      next.splice(idx, 1);
      rebuild(next);
      requestAnimationFrame(() => itemRefs.current[Math.max(0, idx - 1)]?.focus());
    }
  };

  const onParagraphChange = (e) => {
    const listLines = value.split("\n").filter(isListLine);
    const next = [...listLines, ...e.target.value.split("\n")].join("\n");
    onChange(next);
  };

  const paraValue = lines.filter((l) => !isListLine(l)).join("\n");

  // Auto-grow the paragraph textarea so all typed content stays visible.
  const autoGrow = () => {
    const el = paraRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => { autoGrow(); }, [paraValue, value, mode]);

  const bullet = (dim) =>
    `mt-[6px] inline-block h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1.5px] ${dim ? "bg-brand-400/40" : light ? "bg-brand-500" : "bg-brand-400/80"}`;

  // ─── Paragraph mode ───
  if (mode !== "list") {
    return (
      <div className="w-full">
        {items.length > 0 && (
          <ul className="mb-2 space-y-1">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={bullet(false)} aria-hidden />
                <span className={`min-w-0 flex-1 break-words ${light ? "text-slate-700" : "text-slate-300"}`}>{item}</span>
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={paraRef}
          rows={1}
          value={paraValue}
          onChange={(e) => { onParagraphChange(e); requestAnimationFrame(autoGrow); }}
          placeholder={placeholder}
          className={`w-full resize-none overflow-hidden bg-transparent text-xs outline-none ${light ? "text-slate-700 placeholder:text-slate-400" : "text-slate-300 placeholder:text-slate-600"}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.shiftKey || e.metaKey)) {
              e.preventDefault();
              startList();
            }
          }}
        />
        {!value && (
          <span className={`pointer-events-none mt-0.5 block select-none text-[10px] italic ${light ? "text-slate-500" : "text-slate-600"}`}>
            Press Shift + Enter or use the List option to start a list
          </span>
        )}
      </div>
    );
  }

  // ─── List mode ───
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-300/80">
        <span className="inline-block h-1.5 w-1.5 rotate-45 rounded-[1.5px] bg-brand-400" />
        List
      </div>
      {prefixText && (
        <p className={`mb-2 rounded-md border px-2.5 py-1.5 text-[11px] italic ${light ? "border-slate-200 bg-slate-50 text-slate-500" : "border-white/5 bg-white/[0.02] text-slate-500"}`}>
          {prefixText}
        </p>
      )}
      <div className="space-y-0.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span className={bullet(false)} aria-hidden />
            <input
              ref={(el) => (itemRefs.current[idx] = el)}
              value={item}
              onChange={(e) => onItemChange(idx, e.target.value)}
              onKeyDown={(e) => onItemKeyDown(e, idx)}
              placeholder={item === "" ? "List item..." : ""}
              className={`w-full bg-transparent text-xs outline-none ${light ? "text-slate-700 placeholder:text-slate-400" : "text-slate-300 placeholder:text-slate-600"}`}
            />
          </div>
        ))}
      </div>
      <p className={`mt-1.5 text-[10px] italic ${light ? "text-slate-500" : "text-slate-600"}`}>
        Enter = next item · Enter twice = finish list and continue as paragraph
      </p>
    </div>
  );
});

export default ListEditor;
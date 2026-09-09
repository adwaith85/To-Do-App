import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { isListLine, toListLine, fromListLine, isCheckedLine } from "../utils/description";

/**
 * Description editor with two modes:
 *  - paragraph : renders any persisted list as checkbox rows (togglable) plus
 *    an editable textarea for the continuing paragraph text.
 *  - list      : checkbox items; Enter adds the next item, Enter on an empty
 *    item finishes the list and continues as a paragraph below it.
 *
 * List items are persisted in the description string with the `[ ] ` / `[x] `
 * line prefixes (see RichDescription), so the marking survives returning to
 * paragraph mode, is saved to the database, and is re-rendered on the cards.
 * Legacy `• ` prefixed lines keep working and are treated as unchecked.
 */
const ListEditor = forwardRef(function ListEditor(
  { value = "", onChange, placeholder = "Add a note...", light = false },
  ref
) {
  const [mode, setMode] = useState("paragraph");
  const paraRef = useRef(null);
  const itemRefs = useRef([]);

  const lines = value.split("\n");
  const items = lines
    .filter(isListLine)
    .map((l) => ({ text: fromListLine(l), checked: isCheckedLine(l) }));
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
    const queue = nextItems.map((it) => toListLine(it.text, it.checked));
    const out = lines.map((l) => (isListLine(l) ? queue.shift() ?? "" : l));
    if (queue.length) out.push(...queue);
    onChange(out.join("\n"));
  };

  const onItemChange = (idx, text) => {
    const next = items.map((it) => ({ ...it }));
    next[idx].text = text;
    rebuild(next);
  };

  const onToggleItem = (idx) => {
    const next = items.map((it) => ({ ...it }));
    next[idx].checked = !next[idx].checked;
    rebuild(next);
  };

  const onItemKeyDown = (e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const currentIsEmpty = (items[idx]?.text || "").trim() === "";
      if (currentIsEmpty) {
        finishList();
        return;
      }
      const next = items.map((it) => ({ ...it }));
      next.splice(idx + 1, 0, { text: "", checked: false });
      rebuild(next);
      requestAnimationFrame(() => itemRefs.current[idx + 1]?.focus());
    } else if (e.key === "Backspace" && (items[idx]?.text || "").length === 0 && items.length > 1) {
      e.preventDefault();
      const next = items.map((it) => ({ ...it }));
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

  const boxCls = (checked) =>
    `mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors ${
      checked
        ? "border-emerald-400 bg-emerald-500 text-white"
        : light
          ? "border-slate-400 text-slate-500 hover:border-brand-400 hover:text-brand-600"
          : "border-slate-400/80 text-slate-300 hover:border-brand-400 hover:text-brand-300"
    }`;

  const boxContent = (
    <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5" aria-hidden>
      <path d="M2 6.2 4.6 8.8 10 3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const rowCls = (checked) =>
    `min-w-0 flex-1 break-words text-xs ${checked ? "line-through" : ""} ${
      light ? "text-slate-700" : "text-slate-300"
    }`;

  // ─── Paragraph mode ───
  if (mode !== "list") {
    return (
      <div className="w-full">
        {items.length > 0 && (
          <ul className="mb-2 space-y-1">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <button
                  type="button"
                  aria-label={item.checked ? "Mark list item not done" : "Mark list item done"}
                  onClick={() => onToggleItem(i)}
                  className={boxCls(item.checked)}
                >
                  {item.checked && boxContent}
                </button>
                <span className={rowCls(item.checked)}>{item.text}</span>
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
            <button
              type="button"
              aria-label={item.checked ? "Mark list item not done" : "Mark list item done"}
              onClick={() => onToggleItem(idx)}
              className={boxCls(item.checked)}
            >
              {item.checked && boxContent}
            </button>
            <input
              ref={(el) => (itemRefs.current[idx] = el)}
              value={item.text}
              onChange={(e) => onItemChange(idx, e.target.value)}
              onKeyDown={(e) => onItemKeyDown(e, idx)}
              placeholder={item.text === "" ? "List item..." : ""}
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
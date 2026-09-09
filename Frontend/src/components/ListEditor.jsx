import { useState, useRef, forwardRef, useImperativeHandle } from "react";

/**
 * Description editor with two modes:
 *  - paragraph : a normal, auto-growing textarea.
 *  - list      : one line per item, each with a diamond bullet.
 *
 * Behavior:
 *  - `startList()` (called from the UI "Add list" button) moves to a new
 *    line and begins the list.
 *  - Single Enter in list mode adds the next item (stays in the list).
 *  - Enter on an empty item (i.e. a double Enter) ends the list right there,
 *    keeps the typed items, and continues on the next line as a paragraph.
 *  - Shift + Enter in paragraph mode also starts a list.
 */
const ListEditor = forwardRef(function ListEditor(
  { value = "", onChange, placeholder = "Add a note...", light = false },
  ref
) {
  const [mode, setMode] = useState("paragraph");
  const paraRef = useRef(null);
  const itemRefs = useRef([]);

  const rawItems = value.split("\n");
  const items = rawItems.length ? rawItems : [""];

  const focusParagraphAtEnd = () => {
    const el = paraRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    try { el.setSelectionRange(len, len); } catch { /* noop */ }
  };

  const startList = () => {
    let base = value;
    // Ensure the first list item starts on a fresh line after any paragraph text.
    if (base && !base.endsWith("\n")) base = `${base}\n`;
    if (base !== value) onChange(base);
    setMode("list");
    requestAnimationFrame(() => {
      const idx = Math.max(0, (items.length - 1));
      itemRefs.current[idx]?.focus();
    });
  };

  const finishList = () => {
    // Keep typed items; drop trailing empty lines; a blank line then separates
    // the list from the continuing paragraph.
    const trimmed = value.split("\n");
    while (trimmed.length && trimmed[trimmed.length - 1] === "") trimmed.pop();
    let base = trimmed.join("\n");
    if (base) base = `${base}\n\n`;
    if (base !== value) onChange(base);
    setMode("paragraph");
    requestAnimationFrame(focusParagraphAtEnd);
  };

  useImperativeHandle(ref, () => ({ startList }));

  const updateItems = (next) => onChange(next.join("\n"));

  const onItemChange = (idx, text) => {
    const next = [...items];
    next[idx] = text;
    updateItems(next);
  };

  const onItemKeyDown = (e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const currentIsEmpty = (items[idx] || "").trim() === "";
      if (currentIsEmpty) {
        // Double Enter → keep the list, continue as paragraph below it.
        finishList();
        return;
      }
      // Single Enter → add the next item, stay in the list.
      const next = [...items];
      next.splice(idx + 1, 0, "");
      updateItems(next);
      requestAnimationFrame(() => itemRefs.current[idx + 1]?.focus());
    } else if (e.key === "Backspace" && (items[idx] || "").length === 0 && items.length > 1) {
      e.preventDefault();
      const next = [...items];
      next.splice(idx, 1);
      updateItems(next);
      requestAnimationFrame(() => itemRefs.current[Math.max(0, idx - 1)]?.focus());
    }
  };

  // ─── Paragraph mode ───
  if (mode !== "list") {
    return (
      <div className="w-full">
        <textarea
          ref={paraRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full resize-none bg-transparent text-xs outline-none ${light ? "text-slate-700 placeholder:text-slate-400" : "text-slate-300 placeholder:text-slate-600"}`}
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
      <div className="space-y-0.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span className="mt-[6px] inline-block h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1.5px] bg-brand-400/80" aria-hidden />
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
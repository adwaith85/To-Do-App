import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { isListLine, isCheckedLine, fromListLine, toListLine, toggleListLine } from "../utils/description";

/**
 * Description editor that lists are marked in (checkboxes here — not on the
 * card).
 *
 * Lines are kept verbatim: paragraph lines are plain editable text; list lines
 * are shown as checkbox rows that you can tap to mark done. Everything renders
 * in the exact order it was typed — lists are never moved to the top or re-sorted.
 */
const ListEditor = forwardRef(function ListEditor(
  { value = "", onChange, placeholder = "Add a note...", light = false },
  ref
) {
  const boxRef = useRef(null);

  const focusAtEnd = () => {
    const box = boxRef.current;
    if (!box) return;
    const areas = box.querySelectorAll("textarea");
    const el = areas[areas.length - 1];
    if (!el) return;
    el.focus();
    const len = el.value.length;
    try { el.setSelectionRange(len, len); } catch { /* noop */ }
  };

  const startList = () => {
    const base = value.trimEnd();
    const next = base ? `${base}\n[ ] ` : "[ ] ";
    onChange(next);
    requestAnimationFrame(() => {
      const box = boxRef.current;
      if (!box) return;
      const lastIndex = next.split("\n").length - 1;
      const el = box.querySelector(`[data-item="${lastIndex}"]`);
      el?.focus();
    });
  };

  useImperativeHandle(ref, () => ({ startList }));

  // Split into mixed paragraph/list chunks, in the exact typed order.
  const lines = value.split("\n");
  const chunks = [];
  {
    let paraStart = -1;
    const paraRun = [];
    lines.forEach((line, idx) => {
      if (isListLine(line)) {
        if (paraRun.length) {
          chunks.push({ type: "para", start: paraStart, lines: [...paraRun] });
          paraRun.length = 0;
        }
        chunks.push({ type: "list", index: idx });
      } else {
        if (!paraRun.length) paraStart = idx;
        paraRun.push(line);
      }
    });
    if (paraRun.length) chunks.push({ type: "para", start: paraStart, lines: [...paraRun] });
    if (!chunks.length || chunks[chunks.length - 1].type === "list") {
      chunks.push({ type: "para", start: lines.length, lines: [""] });
    }
  }

  const onParaChange = (chunk, text) => {
    const src = value.split("\n");
    const next = [
      ...src.slice(0, chunk.start),
      ...text.split("\n"),
      ...src.slice(chunk.start + chunk.lines.length),
    ];
    onChange(next.join("\n"));
  };

  const toggleItem = (chunk) => {
    const src = value.split("\n");
    src[chunk.index] = toggleListLine(src[chunk.index]);
    onChange(src.join("\n"));
  };

  const editItem = (chunk, text) => {
    const src = value.split("\n");
    const line = src[chunk.index];
    src[chunk.index] = toListLine(text, isCheckedLine(line));
    onChange(src.join("\n"));
  };

  const onItemKeyDown = (e, chunk) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!e.target.value.trim()) {
        finishList(chunk);
        return;
      }
      const src = value.split("\n");
      src.splice(chunk.index + 1, 0, "[ ] ");
      onChange(src.join("\n"));
      requestAnimationFrame(() => boxRef.current?.querySelector(`[data-item="${chunk.index + 1}"]`)?.focus());
    } else if (e.key === "Backspace" && !(e.target.value || "").trim() && value.split("\n").filter(isListLine).length > 1) {
      e.preventDefault();
      const src = value.split("\n");
      src.splice(chunk.index, 1);
      onChange(src.join("\n"));
    }
  };

  const finishList = (chunk) => {
    const src = value.split("\n");
    src.splice(chunk.index, 1);
    while (src.length && isListLine(src[src.length - 1]) && fromListLine(src[src.length - 1]).trim() === "") src.pop();
    onChange(src.join("\n"));
    requestAnimationFrame(focusAtEnd);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.shiftKey || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      startList();
    }
  };

  // Auto-grow every paragraph textarea so all typed content stays visible.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.querySelectorAll("textarea").forEach((el) => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    });
  }, [value]);

  const boxCls = (checked) =>
    `flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors ${
      checked
        ? "border-emerald-400 bg-emerald-500 text-white"
        : light
          ? "border-slate-400 text-slate-500 hover:border-brand-400 hover:text-brand-600"
          : "border-slate-400/80 text-slate-300 hover:border-brand-400 hover:text-brand-300"
    }`;

  const checkSvg = (
    <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5" aria-hidden>
      <path d="M2 6.2 4.6 8.8 10 3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div ref={boxRef} className="w-full space-y-1">
      {chunks.map((chunk, i) => {
        if (chunk.type === "list") {
          const checked = isCheckedLine(lines[chunk.index]);
          const text = fromListLine(lines[chunk.index]);
          return (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                aria-label={checked ? "Mark list item not done" : "Mark list item done"}
                onClick={() => toggleItem(chunk)}
                className={boxCls(checked)}
              >
                {checked && checkSvg}
              </button>
              <input
                data-item={chunk.index}
                type="text"
                value={text}
                onChange={(e) => editItem(chunk, e.target.value)}
                onKeyDown={(e) => onItemKeyDown(e, chunk)}
                placeholder="List item..."
                className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${light ? "text-slate-700 placeholder:text-slate-400" : "text-slate-300 placeholder:text-slate-600"}`}
              />
            </div>
          );
        }
        return (
          <textarea
            key={i}
            rows={1}
            value={chunk.lines.join("\n")}
            onChange={(e) => onParaChange(chunk, e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full resize-none overflow-hidden bg-transparent text-xs outline-none ${light ? "text-slate-700 placeholder:text-slate-400" : "text-slate-300 placeholder:text-slate-600"}`}
          />
        );
      })}
      {!value && (
        <span className={`pointer-events-none mt-0.5 block select-none text-[10px] italic ${light ? "text-slate-500" : "text-slate-600"}`}>
          Press Shift + Enter or use the List option to start a list
        </span>
      )}
      {value && value.split("\n").some(isListLine) && (
        <span className={`pointer-events-none mt-0.5 block select-none text-[10px] italic ${light ? "text-slate-500" : "text-slate-600"}`}>
          In a list: Enter = next item · Enter twice = finish and continue as paragraph
        </span>
      )}
    </div>
  );
});

export default ListEditor;
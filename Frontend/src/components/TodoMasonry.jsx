import { useMemo, useRef, useReducer, useCallback, useEffect } from "react";

const DEFAULT_HEIGHT = 176;

function greedyColumns(items, colCount, heights) {
  if (colCount <= 1 || items.length === 0) return [items];
  const cols = Array.from({ length: colCount }, () => []);
  const colHeights = Array(colCount).fill(0);
  for (const item of items) {
    const height = heights[item._id] ?? DEFAULT_HEIGHT;
    let target = 0;
    for (let i = 1; i < colCount; i += 1) {
      if (colHeights[i] < colHeights[target]) target = i;
    }
    cols[target].push(item);
    colHeights[target] += height;
  }
  return cols;
}

function DropLine() {
  return (
    <div className="pointer-events-none relative z-40 my-0.5 h-[3px] rounded-full bg-brand-400 shadow-[0_0_12px_rgba(116,94,246,0.9)]" />
  );
}

export default function TodoMasonry({
  section,
  items,
  columns,
  renderCard,
  dropTarget,
}) {
  const [heights, setHeights] = useReducer(
    (prev, next) => {
      const height = next.height || DEFAULT_HEIGHT;
      if (Math.abs((prev[next.id] || 0) - height) < 1) return prev;
      return { ...prev, [next.id]: height };
    },
    {}
  );

  const observerRef = useRef(null);

  const getObserver = useCallback(() => {
    if (!observerRef.current) {
      observerRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const id = entry.target?.dataset?.todoId;
          if (id) setHeights({ id, height: entry.contentRect.height });
        }
      });
    }
    return observerRef.current;
  }, []);

  const setNode = useCallback(
    (el) => {
      if (!el) return;
      getObserver().observe(el);
      const id = el.dataset?.todoId;
      if (id) setHeights({ id, height: el.getBoundingClientRect().height });
    },
    [getObserver]
  );

  useEffect(() => {
    const observer = getObserver();
    return () => observer.disconnect();
  }, [getObserver]);

  const cols = useMemo(
    () => greedyColumns(items, columns, heights),
    [items, columns, heights]
  );

  const active = dropTarget && dropTarget.section === section ? dropTarget : null;

  return (
    <div
      data-drop-zone={section}
      onDragOver={(e) => e.preventDefault()}
      className="flex flex-col sm:flex-row sm:items-start sm:gap-3"
    >
      {cols.map((col, colIndex) => (
        <div key={colIndex} className="flex min-w-0 flex-1 flex-col gap-3">
          {col.flatMap((card) => {
            const before =
              active && active.type === "before" && active.cardId === String(card._id);
            const after =
              active && active.type === "after" && active.cardId === String(card._id);
            const id = String(card._id);
            const nodes = [];
            if (before) nodes.push(<DropLine key={`${id}-before`} />);
            nodes.push(
              <div key={`${id}-cell`} ref={setNode} data-todo-id={id} className="relative">
                {renderCard(card)}
              </div>
            );
            if (after) nodes.push(<DropLine key={`${id}-after`} />);
            return nodes;
          })}
          {active && active.type === "end" && colIndex === cols.length - 1 && (
            <DropLine key="section-end" />
          )}
        </div>
      ))}
    </div>
  );
}
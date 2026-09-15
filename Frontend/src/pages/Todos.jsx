import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Rows3, LayoutGrid, Pin, ListTodo } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";
import Spinner from "../components/Spinner";
import TodoCard from "../components/TodoCard";
import TodoMasonry from "../components/TodoMasonry";
import TodoForm from "../components/TodoForm";
import TodoCompose from "../components/TodoCompose";
import ConfirmDialog from "../components/ConfirmDialog";

const compareTodos = (a, b) => {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
  const ao = a.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return new Date(b.createdAt) - new Date(a.createdAt);
};

function SectionHeader({ icon, label, count, light = false }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-lg ${
          light ? "bg-slate-100 text-brand-600" : "bg-brand-500/15 text-brand-400"
        }`}
      >
        {icon}
      </span>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </h2>
      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
        {count}
      </span>
    </div>
  );
}

function SectionDivider() {
  return (
    <div className="my-5 flex items-center gap-3 select-none">
      <div className="h-px flex-1 bg-gradient-to-r from-brand-500/60 via-white/15 to-transparent" />
      <span className="h-1.5 w-1.5 rotate-45 bg-brand-400/50" />
      <div className="h-px flex-1 bg-gradient-to-l from-brand-500/60 via-white/15 to-transparent" />
    </div>
  );
}

export default function Todos() {
  const [todos, setTodos] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTodo, setEditTodo] = useState(null);
  const [layout, setLayout] = useState(() => localStorage.getItem("todoLayout") || "vertical");
  const [columnCount, setColumnCount] = useState(1);
  const [completing, setCompleting] = useState(null);
  const [completingLeft, setCompletingLeft] = useState(0);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const todosRef = useRef(todos);
  const pendingIdRef = useRef(null);
  const dragIdRef = useRef(null);
  const dragActiveRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const pointerRef = useRef({ x: 0, y: 0 });
  const dropTargetRef = useRef(null);
  const scrollRafRef = useRef(null);
  const dragAttachedRef = useRef(false);
  const dragOps = useRef({ move: null, up: null, cancel: null });

  const loadTodos = useCallback(async () => {
    try {
      const { data } = await client.get("/api/todos");
      setTodos(data.data || []);
    } catch {
      setTodos([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    client
      .get("/api/todos")
      .then(({ data }) => !cancelled && setTodos(data.data || []))
      .catch(() => !cancelled && setTodos([]));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  useEffect(() => {
    if (!completing) { setCompletingLeft(0); return undefined; }
    let removed = false;
    const tick = () => {
      const left = Math.max(0, completing.deadline - Date.now());
      setCompletingLeft(Math.ceil(left / 1000));
      if (left <= 0 && !removed) {
        removed = true;
        setTodos((prev) => prev?.filter((t) => t._id !== completing.id));
        setCompleting(null);
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => { removed = true; clearInterval(t); };
  }, [completing]);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (layout === "vertical") setColumnCount(1);
      else setColumnCount(w >= 1024 ? 3 : 2);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [layout]);

  const switchLayout = (mode) => {
    setLayout(mode);
    localStorage.setItem("todoLayout", mode);
  };

  /* ------------------------- drag & drop ------------------------- */

  const scrollTick = useCallback(() => {
    if (!pendingIdRef.current) return;
    const { y } = pointerRef.current;
    const vh = window.innerHeight;
    if (y < 64) window.scrollBy(0, -12);
    else if (y > vh - 64) window.scrollBy(0, 12);
    scrollRafRef.current = requestAnimationFrame(scrollTick);
  }, []);

  const computeTarget = useCallback((x, y) => {
    const el = document.elementFromPoint(x, y);
    const cardEl = el?.closest?.("[data-todo-id]");
    if (cardEl) {
      const id = cardEl.dataset.todoId;
      if (id === dragIdRef.current) return null;
      const rect = cardEl.getBoundingClientRect();
      const after = y > rect.top + rect.height / 2;
      return { section: cardEl.dataset.todoSection, type: after ? "after" : "before", cardId: id };
    }
    const zoneEl = el?.closest?.("[data-drop-zone]");
    if (!zoneEl) return null;
    const section = zoneEl.dataset.dropZone;
    const cards = zoneEl.querySelectorAll("[data-todo-id]");
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        const id = c.dataset.todoId;
        if (id === dragIdRef.current) return null;
        return { section, type: "before", cardId: id };
      }
    }
    const last = cards[cards.length - 1];
    if (last) {
      const id = last.dataset.todoId;
      if (id === dragIdRef.current) return null;
      return { section, type: "after", cardId: id };
    }
    return { section, type: "end" };
  }, []);

  const performDrop = useCallback(async (id) => {
    const all = todosRef.current;
    if (!all?.length) return;
    const dragged = all.find((t) => String(t._id) === id);
    if (!dragged) return;

    const target = dropTargetRef.current;
    if (!target) return;
    const others = all.filter((t) => String(t._id) !== id);
    const toPinned = target.section === "pinned";
    const moved = { ...dragged, isPinned: toPinned };
    const pinnedCount = others.filter((t) => t.isPinned).length;

    let idx;
    if (target.type === "end") {
      idx = toPinned ? pinnedCount : others.length;
    } else {
      idx = others.findIndex((t) => String(t._id) === String(target.cardId));
      if (idx === -1) idx = toPinned ? pinnedCount : others.length;
      if (target.type === "after") idx += 1;
    }
    idx = Math.max(0, Math.min(idx, others.length));

    const next = [...others];
    next.splice(idx, 0, moved);
    setTodos(next);

    const changedPin = toPinned !== dragged.isPinned;
    try {
      const calls = [client.patch("/api/todos/reorder", {
        orders: next.map((t) => ({ id: t._id })),
      })];
      if (changedPin) {
        calls.push(client.patch(`/api/todos/${moved._id}`, { isPinned: toPinned }));
      }
      const [reorderRes, pinRes] = await Promise.all(calls);
      let list = reorderRes.data?.data || next;
      if (pinRes) {
        const saved = pinRes.data?.data;
        list = list.map((t) => (String(t._id) === String(moved._id) ? saved : t));
      }
      setTodos(list.slice().sort(compareTodos));
    } catch {
      toast.error("Could not save the new order");
      loadTodos();
    }
  }, [loadTodos]);

  const onPointerMove = useCallback((e) => dragOps.current.move?.(e), []);
  const onPointerUp = useCallback((e) => dragOps.current.up?.(e), []);
  const onPointerCancel = useCallback(() => dragOps.current.cancel?.(false), []);

  const attachDrag = useCallback(() => {
    if (dragAttachedRef.current) return;
    dragAttachedRef.current = true;
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("blur", onPointerCancel);
  }, [onPointerMove, onPointerUp, onPointerCancel]);

  const detachDrag = useCallback(() => {
    if (!dragAttachedRef.current) return;
    dragAttachedRef.current = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    window.removeEventListener("blur", onPointerCancel);
  }, [onPointerMove, onPointerUp, onPointerCancel]);

  useEffect(() => () => detachDrag(), [detachDrag]);

  dragOps.current.move = (e) => {
    const id = pendingIdRef.current;
    if (!id) return;
    const x = e.clientX;
    const y = e.clientY;
    pointerRef.current = { x, y };
    if (!dragActiveRef.current) {
      const dx = x - startPosRef.current.x;
      const dy = y - startPosRef.current.y;
      if (Math.hypot(dx, dy) < 6) return;
      dragActiveRef.current = true;
      dragIdRef.current = id;
      setDragId(id);
      if (e.cancelable) e.preventDefault();
      scrollRafRef.current = requestAnimationFrame(scrollTick);
    }
    const target = computeTarget(x, y);
    const prev = dropTargetRef.current;
    if (
      prev?.section !== target?.section ||
      prev?.type !== target?.type ||
      prev?.cardId !== target?.cardId
    ) {
      dropTargetRef.current = target;
      setDropTarget(target);
    }
  };

  dragOps.current.up = (e) => {
    const id = pendingIdRef.current;
    const wasActive = dragActiveRef.current;
    dragOps.current.cancel();
    if (wasActive && id) {
      if (e.cancelable) e.preventDefault();
      const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
      window.addEventListener("click", swallow, { capture: true, once: true });
      performDrop(id);
    }
  };

  dragOps.current.cancel = () => {
    pendingIdRef.current = null;
    dragIdRef.current = null;
    dragActiveRef.current = false;
    setDragId(null);
    setDropTarget(null);
    dropTargetRef.current = null;
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = null;
    detachDrag();
  };

  const handlePointerDown = useCallback((e, todo) => {
    if (e.button != null && e.button !== 0) return;
    pendingIdRef.current = String(todo._id);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    pointerRef.current = { x: e.clientX, y: e.clientY };
    dropTargetRef.current = null;
    dragIdRef.current = null;
    dragActiveRef.current = false;
    attachDrag();
  }, [attachDrag]);

  /* ------------------------- todo actions ------------------------- */

  const toggleTodo = async (id) => {
    try {
      const { data } = await client.patch(`/api/todos/${id}/toggle`);
      const updated = data.data;
      setTodos((prev) => prev?.map((t) => (t._id === id ? updated : t)));
      if (updated.status === "completed") {
        setCompleting({ id, deadline: Date.now() + 5000 });
      } else if (completing?.id === id) {
        setCompleting(null);
      }
    } catch {
      toast.error("Could not update task");
    }
  };

  const deleteTodo = async (id) => {
    if (confirmId !== id) return;
    setDeleting(true);
    try {
      await client.delete(`/api/todos/${id}`);
      setTodos((prev) => prev?.filter((t) => t._id !== id));
      toast.success("Task deleted");
    } catch {
      toast.error("Could not delete the task");
    } finally {
      setDeleting(false);
      setConfirmId(null);
    }
  };

  const archiveTodo = async (todo) => {
    try {
      const { data } = await client.patch(`/api/todos/${todo._id}/archive`);
      setTodos((prev) => prev?.filter((t) => t._id !== todo._id));
      toast.success(data.message || "Task archived");
    } catch {
      toast.error("Could not archive the task");
    }
  };

  const pinTodo = async (todo) => {
    const nextPinned = !todo.isPinned;
    const optimistic = todosRef.current?.map((t) =>
      t._id === todo._id ? { ...t, isPinned: nextPinned } : t
    );
    if (optimistic) setTodos(optimistic);
    try {
      const { data } = await client.patch(`/api/todos/${todo._id}`, { isPinned: nextPinned });
      setTodos((prev) => prev?.map((t) => (t._id === todo._id ? data.data : t)));
      toast.success(nextPinned ? "Pinned to top" : "Unpinned");
    } catch {
      toast.error("Could not update pin");
      loadTodos();
    }
  };

  const onComposed = useCallback((todo, isUpdate) => {
    setTodos((prev) => {
      if (!prev) return prev;
      if (isUpdate) return prev.map((t) => (t._id === todo._id ? todo : t));
      if (prev.some((t) => t._id === todo._id)) return prev;
      return [todo, ...prev];
    });
  }, []);

  const onSaved = useCallback((todo) => {
    setTodos((prev) => prev?.map((t) => (t._id === todo._id ? todo : t)));
  }, []);

  const onArchiveFromForm = useCallback((todo) => {
    setTodos((prev) => prev?.filter((t) => t._id !== todo._id));
  }, []);

  const openEdit = (todo) => {
    setEditTodo(todo);
    setFormOpen(true);
  };

  /* ------------------------- derived layout ------------------------- */

  const sorted = useMemo(() => (todos ? [...todos].sort(compareTodos) : []), [todos]);
  const pinned = useMemo(() => sorted.filter((t) => t.isPinned), [sorted]);
  const tasks = useMemo(() => sorted.filter((t) => !t.isPinned), [sorted]);

  if (todos === null) return <Spinner label="Loading your workspace..." />;

  const renderCard = (todo) => (
    <TodoCard
      key={todo._id}
      todo={todo}
      section={todo.isPinned ? "pinned" : "tasks"}
      onToggle={toggleTodo}
      onDelete={() => setConfirmId(todo._id)}
      onArchive={archiveTodo}
      onPin={pinTodo}
      onEdit={openEdit}
      onGripPointerDown={handlePointerDown}
      onBodyPointerDown={handlePointerDown}
      dragging={dragId === String(todo._id)}
      dimmed={Boolean(dragId) && dragId !== String(todo._id)}
      completing={completing?.id === todo._id}
      countdown={completing?.id === todo._id ? completingLeft : 0}
    />
  );

  return (
    <div className="min-h-screen">
      <div className={`mx-auto w-full px-4 py-6 sm:px-6 animate-fade-in ${layout === "horizontal" ? "max-w-6xl" : "max-w-3xl"}`}>
        {/* Layout toggle */}
        <div className="mb-5 flex justify-end">
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button
              onClick={() => switchLayout("vertical")}
              title="Vertical list"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                layout === "vertical" ? "bg-brand-500/20 text-brand-300" : "text-slate-500 hover:text-white"
              }`}
            >
              <Rows3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => switchLayout("horizontal")}
              title="Masonry cards"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                layout === "horizontal" ? "bg-brand-500/20 text-brand-300" : "text-slate-500 hover:text-white"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Compose area */}
        <TodoCompose onCreated={onComposed} />

        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
            <p className="text-lg text-slate-600">No tasks yet</p>
            <p className="mt-1 text-xs text-slate-600">Click above to create one, or drag any card to reorder it</p>
          </div>
        ) : (
          <>
            {/* Pinned section */}
            {pinned.length > 0 && (
              <section aria-label="Pinned tasks">
                <SectionHeader icon={<Pin className="h-3.5 w-3.5" />} label="Pinned" count={pinned.length} />
                <TodoMasonry
                  section="pinned"
                  items={pinned}
                  columns={columnCount}
                  renderCard={renderCard}
                  dropTarget={dropTarget}
                />
              </section>
            )}

            {/* Horizontal divider between sections */}
            {pinned.length > 0 && tasks.length > 0 && <SectionDivider />}

            {/* Tasks section */}
            {tasks.length > 0 && (
              <section aria-label="Tasks">
                <SectionHeader icon={<ListTodo className="h-3.5 w-3.5" />} label="Tasks" count={tasks.length} />
                <TodoMasonry
                  section="tasks"
                  items={tasks}
                  columns={columnCount}
                  renderCard={renderCard}
                  
                  dropTarget={dropTarget}
                />
              </section>
            )}
          </>
        )}
      </div>

      <TodoForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTodo(null); }}
        editTodo={editTodo}
        onSaved={onSaved}
        onArchive={onArchiveFromForm}
        onDelete={(id) => {
          setTodos((prev) => prev?.filter((t) => t._id !== id));
          setEditTodo(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="Delete task?"
        message="This task will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => deleteTodo(confirmId)}
      />
    </div>
  );
}
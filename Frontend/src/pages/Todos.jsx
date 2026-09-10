import { useEffect, useState, useCallback } from "react";
import { Rows3, LayoutGrid } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";
import Spinner from "../components/Spinner";
import TodoCard from "../components/TodoCard";
import TodoForm from "../components/TodoForm";
import TodoCompose from "../components/TodoCompose";
import ConfirmDialog from "../components/ConfirmDialog";

export default function Todos() {
  const [todos, setTodos] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTodo, setEditTodo] = useState(null);
  const [layout, setLayout] = useState(() => localStorage.getItem("todoLayout") || "vertical");
  const [completing, setCompleting] = useState(null);
  const [completingLeft, setCompletingLeft] = useState(0);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .get("/api/todos")
      .then(({ data }) => !cancelled && setTodos(data.data || []))
      .catch(() => !cancelled && setTodos([]));
    return () => { cancelled = true; };
  }, []);

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

  const switchLayout = (mode) => {
    setLayout(mode);
    localStorage.setItem("todoLayout", mode);
  };

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
    try {
      const nextPinned = !todo.isPinned;
      const { data } = await client.patch(`/api/todos/${todo._id}`, { isPinned: nextPinned });
      setTodos((prev) => prev?.map((t) => (t._id === todo._id ? data.data : t)));
      toast.success(nextPinned ? "Pinned to top" : "Unpinned");
    } catch {
      toast.error("Could not update pin");
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

  if (todos === null) return <Spinner label="Loading your workspace..." />;

  const sorted = [...todos].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  // Horizontal grid: 2 cards per row on phones/tablets, 3 columns on lg.
  const count = sorted.length;
  const gridClass =
    count === 1
      ? "grid-cols-1"
      : count === 2
        ? "grid-cols-2"
        : "grid-cols-2 lg:grid-cols-3";

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
              title="Horizontal cards"
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

        {/* Task list */}
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
            <p className="text-lg text-slate-600">No tasks yet</p>
            <p className="mt-1 text-xs text-slate-600">Click above to create one</p>
          </div>
        ) : layout === "horizontal" ? (
          <div className={`grid items-start gap-3 ${gridClass}`}>
            {sorted.map((todo) => (
              <TodoCard
                key={todo._id}
                todo={todo}
                onToggle={toggleTodo}
                onDelete={() => setConfirmId(todo._id)}
                onArchive={archiveTodo}
                onPin={pinTodo}
                onEdit={openEdit}
                completing={completing?.id === todo._id}
                countdown={completing?.id === todo._id ? completingLeft : 0}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 items-start gap-2.5 lg:grid-cols-1">
            {sorted.map((todo) => (
              <TodoCard
                key={todo._id}
                todo={todo}
                onToggle={toggleTodo}
                onDelete={() => setConfirmId(todo._id)}
                onArchive={archiveTodo}
                onPin={pinTodo}
                onEdit={openEdit}
                completing={completing?.id === todo._id}
                countdown={completing?.id === todo._id ? completingLeft : 0}
              />
            ))}
          </div>
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
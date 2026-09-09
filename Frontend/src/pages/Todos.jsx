import { useEffect, useState, useCallback } from "react";
import { Rows3, LayoutGrid } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";
import Spinner from "../components/Spinner";
import TodoCard from "../components/TodoCard";
import TodoForm from "../components/TodoForm";
import TodoCompose from "../components/TodoCompose";

export default function Todos() {
  const [todos, setTodos] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTodo, setEditTodo] = useState(null);
  const [layout, setLayout] = useState(() => localStorage.getItem("todoLayout") || "vertical");

  useEffect(() => {
    let cancelled = false;
    client
      .get("/api/todos")
      .then(({ data }) => !cancelled && setTodos(data.data || []))
      .catch(() => !cancelled && setTodos([]));
    return () => { cancelled = true; };
  }, []);

  const switchLayout = (mode) => {
    setLayout(mode);
    localStorage.setItem("todoLayout", mode);
  };

  const toggleTodo = async (id) => {
    try {
      const { data } = await client.patch(`/api/todos/${id}/toggle`);
      setTodos((prev) => prev?.map((t) => (t._id === id ? data.data : t)));
    } catch {
      toast.error("Could not update task");
    }
  };

  const deleteTodo = async (id) => {
    setTodos((prev) => prev?.filter((t) => t._id !== id));
    try {
      await client.delete(`/api/todos/${id}`);
    } catch {
      toast.error("Could not delete the task");
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

  const toggleTodoItem = async (id, description) => {
    try {
      const { data } = await client.patch(`/api/todos/${id}`, { description });
      setTodos((prev) => prev?.map((t) => (t._id === id ? data.data : t)));
    } catch {
      toast.error("Could not update the list item");
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
    if (editTodo) {
      setTodos((prev) => prev?.map((t) => (t._id === todo._id ? todo : t)));
    } else {
      setTodos((prev) => (prev ? [todo, ...prev] : prev));
    }
    setEditTodo(null);
  }, [editTodo]);

  const onArchiveFromForm = useCallback((todo) => {
    setTodos((prev) => prev?.filter((t) => t._id !== todo._id));
  }, []);

  const openEdit = (todo) => {
    setEditTodo(todo);
    setFormOpen(true);
  };

  if (todos === null) return <Spinner label="Loading your workspace..." />;

  const completedCount = todos.filter((t) => t.status === "completed").length;
  const pinnedCount = todos.filter((t) => t.isPinned).length;

  const sorted = [...todos].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  // Horizontal grid columns follow the card count: 1 card = full width,
  // 2 cards = two equal columns, 3+ cards = three equal columns
  // (the final partial row keeps the same width as the others).
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
        {/* Compact stats */}
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500">
          <span>{todos.length} total</span>
          <span className="text-emerald-500">{completedCount} done</span>
          <span className="text-accent-400">{todos.length - completedCount} open</span>
          {pinnedCount > 0 && <span className="text-brand-300">{pinnedCount} pinned</span>}
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
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
                onToggleItem={toggleTodoItem}
                onDelete={deleteTodo}
                onArchive={archiveTodo}
                onPin={pinTodo}
                onEdit={openEdit}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sorted.map((todo) => (
              <TodoCard
                key={todo._id}
                todo={todo}
                onToggle={toggleTodo}
                onToggleItem={toggleTodoItem}
                onDelete={deleteTodo}
                onArchive={archiveTodo}
                onPin={pinTodo}
                onEdit={openEdit}
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
    </div>
  );
}
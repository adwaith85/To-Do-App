import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import client from "../api/client";
import Spinner from "../components/Spinner";
import Navbar from "../components/Navbar";
import TodoCard from "../components/TodoCard";
import TodoForm from "../components/TodoForm";
import TodoCompose from "../components/TodoCompose";

export default function Todos() {
  const [todos, setTodos] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTodo, setEditTodo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    client
      .get("/api/todos")
      .then(({ data }) => !cancelled && setTodos(data.data || []))
      .catch(() => !cancelled && setTodos([]));
    return () => { cancelled = true; };
  }, []);

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

  // Called by TodoCompose when a todo is created or updated via auto-save
  const onComposed = useCallback((todo, isUpdate) => {
    setTodos((prev) => {
      if (!prev) return prev;
      if (isUpdate) return prev.map((t) => (t._id === todo._id ? todo : t));
      // New todo — add to top if not already present
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

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 animate-fade-in">
        {/* Compact stats */}
        <div className="mb-5 flex items-center gap-4 text-xs font-medium text-slate-500">
          <span>{todos.length} total</span>
          <span className="text-emerald-500">{completedCount} done</span>
          <span className="text-accent-400">{todos.length - completedCount} open</span>
          {pinnedCount > 0 && <span className="text-brand-300">{pinnedCount} pinned</span>}
        </div>

        {/* Compose area */}
        <TodoCompose onCreated={onComposed} />

        {/* Task list */}
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
            <p className="text-lg text-slate-600">No tasks yet</p>
            <p className="mt-1 text-xs text-slate-600">Click the + above to add one</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sorted.map((todo) => (
              <TodoCard
                key={todo._id}
                todo={todo}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
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
      />
    </div>
  );
}

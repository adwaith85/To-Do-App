/**
 * Todos page — protected by ProtectedRoute + backend JWT auth.
 * Same features as the original app (add / toggle / delete / stats),
 * rebuilt with Tailwind and wired to the authenticated axios client
 * (Authorization header + silent refresh handled by the interceptors).
 */
import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../context/useAuth";
import Spinner from "../components/Spinner";

export default function Todos() {
  const { user, logout } = useAuth();

  const [todos, setTodos] = useState(null); // null = still loading
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  /* ---- Load todos on mount ---- */
  useEffect(() => {
    let cancelled = false;
    client
      .get("/api/todos")
      .then(({ data }) => !cancelled && setTodos(data.data || []))
      .catch(() => !cancelled && setTodos([]));
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Actions ---- */

  const addTodo = async (e) => {
    e.preventDefault();
    const task = input.trim();
    if (!task) return;

    setBusy(true);
    try {
      const { data } = await client.post("/api/todos", { task });
      setTodos((prev) => [data.data, ...(prev || [])]);
      setInput("");
    } catch {
      // Interceptor may refresh & retry; surface failures quietly.
    } finally {
      setBusy(false);
    }
  };

  const toggleTodo = async (id) => {
    try {
      const { data } = await client.patch(`/api/todos/${id}`);
      setTodos((prev) => prev?.map((t) => (t._id === id ? data.data : t)));
    } catch {
      /* noop — refresh flow handles transient 401s */
    }
  };

  const deleteTodo = async (id) => {
    // Optimistic removal for snappy UX.
    setTodos((prev) => prev?.filter((t) => t._id !== id));
    try {
      await client.delete(`/api/todos/${id}`);
    } catch {
      /* noop */
    }
  };

  if (todos === null) return <Spinner label="Loading your tasks..." />;

  const completedCount = todos.filter((t) => t.status === "completed").length;

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      {/* Top bar */}
      <div className="mb-8 flex w-full max-w-xl items-center justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-2xl font-bold text-transparent">
            Secure Todo
          </h1>
          <p className="text-xs text-slate-400">
            Welcome back, {user?.name}
          </p>
        </div>
        <button onClick={logout} className="btn-ghost border border-white/10">
          Log out
        </button>
      </div>

      {/* Card */}
      <div className="glass-card max-w-xl p-6 sm:p-8">
        {/* Stats */}
        <div className="mb-6 flex justify-around rounded-xl border border-white/10 bg-white/[0.02] py-3 text-sm text-slate-400">
          <span><b className="text-white">{todos.length}</b> Total</span>
          <span><b className="text-emerald-400">{completedCount}</b> Completed</span>
        </div>

        {/* Add form */}
        <form onSubmit={addTodo} className="mb-8 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a new task..."
            maxLength={200}
            className="input-field"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="shrink-0 rounded-xl bg-indigo-500 px-5 text-sm font-semibold transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </form>

        {/* List */}
        {todos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center italic text-slate-500">
            No tasks yet. Add one to get started!
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {todos.map((todo) => (
              <li
                key={todo._id}
                className="group flex items-center gap-4 rounded-2xl border border-transparent bg-white/[0.03] px-5 py-4 transition hover:scale-[1.01] hover:border-white/10 hover:bg-white/[0.06]"
              >
                {/* Custom checkbox */}
                <label className="flex cursor-pointer items-center gap-4">
                  <input
                    type="checkbox"
                    checked={todo.status === "completed"}
                    onChange={() => toggleTodo(todo._id)}
                    className="peer sr-only"
                  />
                  <span
                    className={`
                      flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-white/20 text-[11px] text-transparent transition
                      peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:text-white
                      hover:border-indigo-400
                    `}
                  >
                    ✓
                  </span>
                </label>

                {/* Task label with animated strike-through */}
                <span
                  className={`relative min-w-0 flex-1 break-words ${
                    todo.status === "completed" ? "text-slate-500" : "text-slate-100"
                  }`}
                >
                  {todo.task}
                  {todo.status === "completed" && (
                    <span className="absolute left-0 top-1/2 h-px w-full bg-slate-500" />
                  )}
                </span>

                {/* Delete */}
                <button
                  onClick={() => deleteTodo(todo._id)}
                  title="Delete task"
                  aria-label={`Delete ${todo.task}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-sm text-rose-400 opacity-0 transition group-hover:opacity-100 hover:rotate-90 hover:bg-rose-500 hover:text-white focus:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-8 text-xs text-slate-500">Session secured by JWT · access tokens rotate silently</p>
    </div>
  );
}

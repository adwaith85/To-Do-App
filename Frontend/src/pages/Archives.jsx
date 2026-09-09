import { useEffect, useState } from "react";
import { Archive, RotateCcw, Trash2, Check, Calendar, Clock, Pin } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";
import Spinner from "../components/Spinner";
import { isWhiteTheme } from "../utils/theme";
import RichDescription from "../components/RichDescription";

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Archives() {
  const [todos, setTodos] = useState(null);

  const load = () => {
    client
      .get("/api/todos/archived")
      .then(({ data }) => setTodos(data.data || []))
      .catch(() => setTodos([]));
  };

  useEffect(() => { load(); }, []);

  const restore = async (id) => {
    try {
      const { data } = await client.patch(`/api/todos/${id}/unarchive`);
      toast.success(data.message || "Task restored");
      setTodos((prev) => prev?.filter((t) => t._id !== id));
    } catch {
      toast.error("Could not restore task");
    }
  };

  const remove = async (id) => {
    setTodos((prev) => prev?.filter((t) => t._id !== id));
    try {
      await client.delete(`/api/todos/${id}`);
      toast.success("Task deleted");
    } catch {
      toast.error("Could not delete the task");
    }
  };

  if (todos === null) return <Spinner label="Loading archives..." />;

  // Count-based columns: 1 = full width, 2 = two columns, 3+ = three columns.
  // The partial final row keeps the same width as full rows.
  const count = todos.length;
  const gridClass = count === 1
    ? "grid-cols-1"
    : count === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 animate-fade-in">
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Archives</h1>
              <p className="text-xs text-slate-400">{todos.length} archived task(s)</p>
            </div>
          </div>
        </header>

        {todos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
            <div className="mb-2 flex justify-center text-3xl"><Archive className="h-8 w-8 text-slate-600" /></div>
            <p className="italic text-slate-500">Nothing archived yet. Archive a task to keep it out of sight.</p>
          </div>
        ) : (
          <div className={`grid items-start gap-3 ${gridClass}`}>
            {todos.map((todo) => {
              const isCompleted = todo.status === "completed";
              const light = isWhiteTheme(todo.backgroundColor);
              return (
                <div
                  key={todo._id}
                  className={`group relative flex flex-col rounded-2xl border p-4 transition-all duration-200 ${
                    light
                      ? isCompleted
                        ? "border-slate-200 bg-white opacity-60"
                        : "border-slate-200 bg-white hover:border-brand-300 hover:bg-white"
                      : isCompleted
                        ? "border-white/5 bg-white/[0.02] opacity-60"
                        : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                  }`}
                  style={todo.backgroundColor ? { background: todo.backgroundColor } : undefined}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${light ? "border-slate-300" : "border-white/20"}`}>
                      {isCompleted && <Check className="h-3 w-3 text-emerald-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className={`block break-words text-sm font-semibold ${isCompleted ? "text-slate-400 line-through" : light ? "text-slate-900" : "text-slate-100"}`}>
                        {todo.task}
                      </span>
{todo.description && (
                        <RichDescription
                          description={todo.description}
                          light={light}
                          textClass={light ? "text-slate-500" : "text-slate-400"}
                          className="mt-1 max-h-40 overflow-y-auto pr-1 text-xs leading-relaxed [scrollbar-width:thin]"
                        />
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                        {todo.isPinned && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-brand-400/30 bg-brand-400/10 px-1.5 py-0.5 font-medium text-brand-300">
                            <Pin className="h-2.5 w-2.5" /> Pinned
                          </span>
                        )}
                        {todo.dueDate && (
                          <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${light ? "border-slate-200 bg-slate-100 text-slate-600" : "border-white/10 bg-white/5 text-slate-400"}`}>
                            <Calendar className="h-2.5 w-2.5" /> Due {fmtDateTime(todo.dueDate)}
                          </span>
                        )}
                        {todo.reminderAt && (
                          <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${light ? "border-accent-500/30 bg-accent-500/10 text-accent-600" : "border-accent-400/30 bg-accent-400/10 text-accent-400"}`}>
                            <Clock className="h-2.5 w-2.5" /> {fmtDateTime(todo.reminderAt)}
                          </span>
                        )}
                        <span className={light ? "text-slate-400" : "text-slate-600"}>Archived {fmtDateTime(todo.updatedAt || todo.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`mt-3 flex items-center justify-end gap-1.5 border-t pt-2.5 ${light ? "border-slate-200" : "border-white/5"}`}>
                    <button
                      onClick={() => restore(todo._id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
                    >
                      <RotateCcw className="h-3 w-3" /> Restore
                    </button>
                    <button
                      onClick={() => remove(todo._id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-400/20"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
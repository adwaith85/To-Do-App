import { useState, useEffect } from "react";
import { Bell, Clock, Calendar, AlertTriangle, Check } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";
import Spinner from "../components/Spinner";
import Navbar from "../components/Navbar";
import CalendarComponent from "../components/Calendar";

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Reminders() {
  const [todos, setTodos] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    let cancelled = false;
    client
      .get("/api/todos")
      .then(({ data }) => !cancelled && setTodos(data.data || []))
      .catch(() => !cancelled && setTodos([]));
    return () => { cancelled = true; };
  }, []);

  if (todos === null) return <Spinner label="Loading reminders..." />;

  const reminderTodos = todos.filter((t) => t.reminderAt);
  const now = new Date();
  const upcoming = reminderTodos
    .filter((t) => new Date(t.reminderAt) > now)
    .sort((a, b) => new Date(a.reminderAt) - new Date(b.reminderAt));
  const pastDue = reminderTodos
    .filter((t) => new Date(t.reminderAt) <= now && t.status !== "completed")
    .sort((a, b) => new Date(b.reminderAt) - new Date(a.reminderAt));
  const completed = reminderTodos.filter((t) => t.status === "completed");

  const selectedTodos = selectedDate
    ? reminderTodos.filter((t) => {
        const d = new Date(t.reminderAt).toISOString().slice(0, 10);
        return d === selectedDate;
      })
    : [];

  const toggleTodo = async (id) => {
    try {
      const { data } = await client.patch(`/api/todos/${id}/toggle`);
      setTodos((prev) => prev?.map((t) => (t._id === id ? data.data : t)));
    } catch {
      toast.error("Could not update task");
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 animate-fade-in">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/20 text-accent-400">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Reminders</h1>
              <p className="text-xs text-slate-400">
                {upcoming.length} upcoming · {pastDue.length} past due
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {selectedDate && (
              <div className="flex items-center gap-3 rounded-2xl border border-brand-400/20 bg-brand-500/10 px-4 py-3">
                <Calendar className="h-4 w-4 text-brand-400" />
                <span className="text-sm font-medium text-brand-300">
                  Showing reminders for {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </span>
                <button onClick={() => setSelectedDate(null)} className="ml-auto text-xs font-semibold text-brand-400 hover:text-brand-300 transition">
                  Clear filter
                </button>
              </div>
            )}

            {(selectedDate ? selectedTodos.filter((t) => new Date(t.reminderAt) <= now && t.status !== "completed") : pastDue).length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> Past Due
                </h2>
                <div className="space-y-2">
                  {(selectedDate ? selectedTodos.filter((t) => new Date(t.reminderAt) <= now && t.status !== "completed") : pastDue).map((todo) => (
                    <ReminderCard key={todo._id} todo={todo} onToggle={toggleTodo} isPastDue />
                  ))}
                </div>
              </section>
            )}

            {(selectedDate ? selectedTodos.filter((t) => new Date(t.reminderAt) > now) : upcoming).length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent-400">
                  <Clock className="h-3.5 w-3.5" /> Upcoming
                </h2>
                <div className="space-y-2">
                  {(selectedDate ? selectedTodos.filter((t) => new Date(t.reminderAt) > now) : upcoming).map((todo) => (
                    <ReminderCard key={todo._id} todo={todo} onToggle={toggleTodo} />
                  ))}
                </div>
              </section>
            )}

            {(selectedDate ? selectedTodos.filter((t) => t.status === "completed") : completed).length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Completed
                </h2>
                <div className="space-y-2">
                  {(selectedDate ? selectedTodos.filter((t) => t.status === "completed") : completed).map((todo) => (
                    <ReminderCard key={todo._id} todo={todo} onToggle={toggleTodo} isCompleted />
                  ))}
                </div>
              </section>
            )}

            {reminderTodos.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
                <div className="mb-2 text-3xl">🔔</div>
                <p className="italic text-slate-500">No reminders yet. Add one when creating a task.</p>
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-20">
            <CalendarComponent
              todos={reminderTodos}
              onDateClick={setSelectedDate}
              selectedDate={selectedDate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReminderCard({ todo, onToggle, isPastDue, isCompleted }) {
  return (
    <div
      className={`group flex items-start gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 ${
        isCompleted
          ? "border-white/5 bg-white/[0.02] opacity-50"
          : isPastDue
            ? "border-rose-400/20 bg-rose-400/5"
            : "border-white/10 bg-white/[0.04] hover:border-brand-400/30 hover:bg-white/[0.07]"
      }`}
    >
      <button
        onClick={() => onToggle(todo._id)}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
          isCompleted
            ? "border-emerald-400 bg-emerald-400 text-white"
            : "border-white/20 hover:border-brand-400"
        }`}
      >
        {isCompleted && <Check className="h-3 w-3" />}
      </button>

      <div className="min-w-0 flex-1">
        <span className={`block text-sm font-medium ${isCompleted ? "text-slate-500 line-through" : "text-slate-100"}`}>
          {todo.task}
        </span>
        <div className="mt-1.5 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${
            isPastDue
              ? "border-rose-400/20 bg-rose-400/10 text-rose-400"
              : isCompleted
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-400"
                : "border-accent-400/30 bg-accent-400/10 text-accent-400"
          }`}>
            <Clock className="h-2.5 w-2.5" /> {fmtDateTime(todo.reminderAt)}
          </span>
          {todo.dueDate && (
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
              <Calendar className="h-2.5 w-2.5" /> Due {fmtDateTime(todo.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

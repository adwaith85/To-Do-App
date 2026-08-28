/**
 * Todos page — protected by ProtectedRoute + backend JWT auth.
 *
 * Layout (xl): two columns —
 *   left  : tasks (add / toggle / delete / stats)
 *   right : Account & Security — profile chip, 2FA toggle,
 *           active device sessions with per-device revoke + logout-all.
 * All API calls ride the axios client (bearer + silent refresh).
 */
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import client from "../api/client";
import { useAuth } from "../context/useAuth";
import Spinner from "../components/Spinner";

/* Pretty-print a stored user-agent into something human. */
function deviceLabel(ua = "") {
  const s = ua.toLowerCase();
  const browser =
    s.includes("edg/") ? "Edge"
    : s.includes("chrome") ? "Chrome"
    : s.includes("firefox") ? "Firefox"
    : s.includes("safari") ? "Safari"
    : s.includes("node") ? "API client"
    : "Browser";
  const os =
    s.includes("windows") ? "Windows"
    : s.includes("mac") ? "macOS"
    : s.includes("android") ? "Android"
    : s.includes("iphone|ipad|ios") || /iphone|ipad/.test(s) ? "iOS"
    : s.includes("linux") ? "Linux"
    : "";
  return [browser, os].filter(Boolean).join(" · ");
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* Compact "Sep 21" style date helper for due dates. */
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* Badge tones per priority. */
const priorityTone = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  high: "border-rose-500/30 bg-rose-500/10 text-rose-400",
};

function Chip({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
      {children}
    </span>
  );
}

export default function Todos() {
  const { user, logout, toggleTwoFactor } = useAuth();

  /* ---- Tasks state ---- */
  const [todos, setTodos] = useState(null); // null = still loading
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [details, setDetails] = useState({
    description: "",
    priority: "medium",
    dueDate: "",
    tags: "",
  });
  const [pinned, setPinned] = useState(false);

  /* ---- Sessions state ---- */
  const [sessions, setSessions] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

  const loadSessions = useCallback(() => {
    client
      .get("/api/auth/sessions")
      .then(({ data }) => setSessions(data.data?.sessions || []))
      .catch(() => setSessions([]));
  }, []);

  /* ---- Load both panels on mount ---- */
  useEffect(() => {
    let cancelled = false;
    client
      .get("/api/todos")
      .then(({ data }) => !cancelled && setTodos(data.data || []))
      .catch(() => !cancelled && setTodos([]));
    loadSessions();
    return () => {
      cancelled = true;
    };
  }, [loadSessions]);

  /* ---- Task actions ---- */

  const addTodo = async (e) => {
    e.preventDefault();
    const task = input.trim();
    if (!task) return;

    const tags = details.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

    setBusy(true);
    try {
      const { data } = await client.post("/api/todos", {
        task,
        description: details.description.trim(),
        priority: details.priority,
        dueDate: details.dueDate || undefined,
        tags,
        isPinned: pinned,
      });
      setTodos((prev) => [data.data, ...(prev || [])]);
      setInput("");
      setPinned(false);
      setDetails({ description: "", priority: "medium", dueDate: "", tags: "" });
      setShowDetails(false);
      toast.success("Task added");
    } catch {
      toast.error("Could not add the task");
    } finally {
      setBusy(false);
    }
  };

  const toggleTodo = async (id) => {
    try {
      const { data } = await client.patch(`/api/todos/${id}`);
      setTodos((prev) => prev?.map((t) => (t._id === id ? data.data : t)));
    } catch {
      /* silent refresh flow handles transient 401s */
    }
  };

  const deleteTodo = async (id) => {
    // Optimistic removal for snappy UX.
    setTodos((prev) => prev?.filter((t) => t._id !== id));
    try {
      await client.delete(`/api/todos/${id}`);
    } catch {
      toast.error("Could not delete the task");
    }
  };

  /* ---- Session actions ---- */

  const revokeSession = async (id) => {
    setRevokingId(id);
    try {
      const { data } = await client.delete(`/api/auth/sessions/${id}`);
      toast.success(data.message || "Device signed out");

      if (/^this device/i.test(data.message || "")) {
        // We just killed OUR OWN session — refresh cookie is dead server-side.
        await logout();
      } else {
        setSessions((prev) => prev?.filter((s) => s.id !== id));
      }
    } catch {
      toast.error("Could not sign out that device");
    } finally {
      setRevokingId(null);
    }
  };

  const logoutAllDevices = async () => {
    try {
      await client.post("/api/auth/logout-all");
      await logout();
      toast.success("Signed out everywhere");
    } catch {
      toast.error("Could not sign out all devices");
    }
  };

  const onToggle2fa = async (e) => {
    const enabled = e.target.checked;
    try {
      const { data } = await toggleTwoFactor(enabled);
      toast.success(data.message || `Two-factor ${enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      e.target.checked = !enabled; // revert the switch on failure
      toast.error(err.response?.data?.message || "Could not change 2FA setting");
    }
  };

  if (todos === null) return <Spinner label="Loading your workspace..." />;

  const completedCount = todos.filter((t) => t.status === "completed").length;

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* ── Top bar ── */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 text-lg font-black text-white shadow-glow">
            ✓
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SecureTodo</h1>
            <p className="text-xs text-slate-400">
              Welcome back, <span className="text-slate-200">{user?.name}</span>
            </p>
          </div>
        </div>

        <button onClick={logout} className="btn-secondary">
          Log out
        </button>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* ══════════ TASKS ══════════ */}
        <section className="glass-card p-6 sm:p-8">
          {/* Stats */}
          <div className="mb-6 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Total", value: todos.length, tone: "text-white" },
              { label: "Completed", value: completedCount, tone: "text-emerald-400" },
              { label: "Open", value: todos.length - completedCount, tone: "text-accent-400" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/5 bg-white/[0.03] py-4">
                <div className={`text-2xl font-extrabold ${s.tone}`}>{s.value}</div>
                <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Add form */}
          <form onSubmit={addTodo} className="mb-7">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="What needs doing?"
                maxLength={200}
                className="input-field"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="btn-primary w-auto shrink-0 px-6"
              >
                Add
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowDetails((s) => !s)}
              className="mt-2.5 text-xs font-semibold text-slate-400 transition hover:text-brand-300"
            >
              {showDetails ? "− Hide details" : "+ Add details"}
            </button>

            {showDetails && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="todo-desc" className="label-text">Description</label>
                  <textarea
                    id="todo-desc"
                    rows={2}
                    value={details.description}
                    maxLength={2000}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, description: e.target.value }))
                    }
                    placeholder="Optional notes…"
                    className="input-field resize-none"
                  />
                </div>

                <div>
                  <label htmlFor="todo-priority" className="label-text">Priority</label>
                  <select
                    id="todo-priority"
                    value={details.priority}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, priority: e.target.value }))
                    }
                    className="input-field cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="todo-due" className="label-text">Due date</label>
                  <input
                    id="todo-due"
                    type="date"
                    value={details.dueDate}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, dueDate: e.target.value }))
                    }
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="todo-tags" className="label-text">Tags (comma separated)</label>
                  <input
                    id="todo-tags"
                    type="text"
                    value={details.tags}
                    maxLength={300}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, tags: e.target.value }))
                    }
                    placeholder="work, urgent, home…"
                    className="input-field"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 pt-6 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 accent-brand-500"
                  />
                  📌 Pin to top
                </label>
              </div>
            )}
          </form>

          {/* List */}
          {todos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
              <div className="mb-2 text-3xl">🌤️</div>
              <p className="italic text-slate-500">Nothing yet — add your first task above.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {todos.map((todo) => (
                <li
                  key={todo._id}
                  className="group flex items-center gap-4 rounded-2xl border border-transparent bg-white/[0.03] px-5 py-4 transition hover:border-white/10 hover:bg-white/[0.06]"
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
                        hover:border-brand-400
                      `}
                    >
                      ✓
                    </span>
                  </label>

                  {/* Task label with animated strike-through */}
                  <div className="min-w-0 flex-1">
                    <span
                      className={`relative block break-words ${
                        todo.status === "completed" ? "text-slate-500" : "text-slate-100"
                      }`}
                    >
                      {todo.task}
                      {todo.status === "completed" && (
                        <span className="absolute left-0 top-1/2 h-px w-full bg-slate-500" />
                      )}
                    </span>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {todo.isPinned && <Chip>📌 Pinned</Chip>}
                      {todo.priority && todo.priority !== "medium" && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${priorityTone[todo.priority] || ""}`}
                        >
                          {todo.priority}
                        </span>
                      )}
                      {todo.dueDate && <Chip>🗓 {fmtDate(todo.dueDate)}</Chip>}
                      {(todo.tags || []).map((t) => (
                        <Chip key={t}>#{t}</Chip>
                      ))}
                    </div>

                    {todo.description && (
                      <p className="mt-1 line-clamp-2 max-w-md text-xs leading-relaxed text-slate-400">
                        {todo.description}
                      </p>
                    )}
                  </div>

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
        </section>

        {/* ══════════ ACCOUNT & SECURITY ══════════ */}
        <aside className="space-y-6">
          {/* Profile card */}
          <section className="glass-card p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
              Account
            </h2>
            <div className="space-y-2 text-sm">
              <p className="flex justify-between gap-3">
                <span className="text-slate-500">Name</span>
                <span className="truncate font-medium">{user?.name}</span>
              </p>
              <p className="flex justify-between gap-3">
                <span className="text-slate-500">Email</span>
                <span className="truncate font-medium">{user?.email}</span>
              </p>
              <p className="flex justify-between gap-3">
                <span className="text-slate-500">Phone</span>
                <span className="font-medium">{user?.phone}</span>
              </p>
            </div>
          </section>

          {/* Two-factor switch */}
          <section className="glass-card p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
              Security
            </h2>
            <label className="flex cursor-pointer items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-semibold">Two-factor login</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                  Email a code at every sign-in, after your password.
                </span>
              </span>
              <span className="relative inline-flex shrink-0">
                <input
                  type="checkbox"
                  checked={Boolean(user?.twoFactorEnabled)}
                  onChange={onToggle2fa}
                  className="peer sr-only"
                />
                <span className="block h-6 w-11 rounded-full bg-white/15 transition peer-checked:bg-brand-500" />
                <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </span>
            </label>
          </section>

          {/* Active sessions */}
          <section className="glass-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Devices & sessions
              </h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                {sessions?.length ?? "…"} active
              </span>
            </div>

            {!sessions ? (
              <p className="py-4 text-sm text-slate-500">Loading sessions…</p>
            ) : sessions.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">No other active sessions.</p>
            ) : (
              <ul className="space-y-2.5">
                {sessions.map((s) => (
                  <li key={s.id} className="list-row">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        {deviceLabel(s.device)}
                        {s.current && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                            this device
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        IP {s.ip} · signed in {timeAgo(s.createdAt)}
                        {s.rememberMe && " · remembered"}
                      </p>
                    </div>
                    <button
                      onClick={() => revokeSession(s.id)}
                      disabled={revokingId === s.id}
                      className="btn-danger shrink-0"
                    >
                      {revokingId === s.id ? "…" : "Sign out"}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button onClick={logoutAllDevices} className="btn-secondary mt-5 w-full">
              Sign out of ALL devices
            </button>
          </section>
        </aside>
      </div>

      <p className="mt-10 pb-4 text-center text-xs text-slate-600">
        Session secured by rotating JWT tokens · logged-out tokens are permanently blacklisted
      </p>
    </div>
  );
}

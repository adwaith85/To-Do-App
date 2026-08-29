/**
 * AdminLayout — shared shell for every /admin page.
 *
 * Left rail navigation + top bar with the acting admin's identity and a
 * link back to the user-facing app. Pages render through <Outlet />.
 */
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

const NAV = [
  { to: "/admin", end: true, icon: "📊", label: "Dashboard" },
  { to: "/admin/users", icon: "👥", label: "Users" },
  { to: "/admin/security", icon: "🛡️", label: "Login & Security" },
  { to: "/admin/todos", icon: "✅", label: "Todos" },
  { to: "/admin/audit", icon: "🧾", label: "Audit Log" },
];

export default function AdminLayout() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6">
      <div className="flex flex-1 flex-col gap-6 md:flex-row">
        {/* ── Sidebar ── */}
        <aside className="glass-card h-fit shrink-0 p-4 md:w-60">
          <div className="mb-4 flex items-center gap-3 px-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 text-lg font-black text-white shadow-glow">
              ⚙
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">Admin Panel</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-accent-400">
                {role === "admin" ? "Admin session" : "Session"}
              </p>
            </div>
          </div>

          <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-brand-500/15 text-brand-200"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <span>{n.icon}</span>
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* ── Main column ── */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {/* Top bar */}
          <header className="glass-card flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-base">
                👤
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user?.name}</p>
                <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/")}
                className="btn-secondary !py-2 text-xs"
                title="Back to your todos"
              >
                My app
              </button>
              <button onClick={logout} className="btn-ghost !py-2 text-xs">
                Log out
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

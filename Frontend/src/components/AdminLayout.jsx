/**
 * AdminLayout — the "Slate console" shell wrapping every /admin page.
 *
 * Distinct from the user app on purpose:
 *   - dark slate liquid-glass panels (see .admin-* in index.css)
 *   - fixed left rail on desktop, slide-over drawer on mobile
 *   - cyan→emerald accent versus the user app's violet "Aurora".
 *
 * Route gating happens one level up in <AdminProtectedRoute>; this
 * component only concerns itself with chrome and navigation.
 */
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, ShieldCheck, ListTodo, ScrollText,
  ArrowLeft, LogOut, Menu, X, MonitorSmartphone, Activity,
} from "lucide-react";
import { useAuth } from "../context/useAuth";
import { Avatar } from "./admin/ui";

const NAV = [
  { to: "/admin", end: true, icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/security", icon: ShieldCheck, label: "Login & Security" },
  { to: "/admin/todos", icon: ListTodo, label: "Todos" },
  { to: "/admin/audit", icon: ScrollText, label: "Audit Log" },
];

/** Map the active pathname to a page title (for the top bar). */
function titleFor(pathname) {
  if (pathname === "/admin") return "Dashboard";
  if (/^\/admin\/users\/[^/]+/.test(pathname)) return "User Profile";
  if (pathname.startsWith("/admin/users")) return "Users";
  if (pathname.startsWith("/admin/security")) return "Login & Security";
  if (pathname.startsWith("/admin/todos")) return "Todos";
  if (pathname.startsWith("/admin/audit")) return "Audit Log";
  return "Admin Console";
}

function NavList({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              isActive
                ? "bg-cyan-500/15 text-cyan-200 shadow-[inset_0_0_0_1px_rgb(34_211_238/0.25)]"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <n.icon className={`h-4.5 w-4.5 transition ${isActive ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}`} />
              <span>{n.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer whenever the route changes (covers browser
  // back/forward, where no NavLink onClick fires). Deferred via a timer so
  // the state update isn't synchronous inside the effect body.
  useEffect(() => {
    const t = setTimeout(() => setDrawerOpen(false), 0);
    return () => clearTimeout(t);
  }, [location.pathname]);

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="admin-shell">
      {/* ───── Desktop sidebar ───── */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-400/10 lg:bg-slate-950/40 lg:backdrop-blur-xl">
        <Logo />
        <div className="flex-1 overflow-y-auto py-4">
          <NavList />
        </div>
        <AdminFooter user={user} role={role} onLogout={signOut} onGoApp={() => navigate("/")} />
      </aside>

      {/* ───── Mobile drawer ───── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-slate-400/10 bg-slate-950/90 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between pr-3">
              <Logo />
              <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              <NavList onNavigate={() => setDrawerOpen(false)} />
            </div>
            <AdminFooter user={user} role={role} onLogout={signOut} onGoApp={() => navigate("/")} />
          </aside>
        </div>
      )}

      {/* ───── Main column ───── */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-400/10 bg-slate-950/50 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-2 text-slate-300 hover:bg-white/5 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/70">
                <Activity className="h-3 w-3" /> Admin Console
              </p>
              <h1 className="truncate text-base font-black tracking-tight text-white lg:text-lg">
                {titleFor(location.pathname)}
              </h1>
            </div>

            <button
              onClick={() => navigate("/")}
              title="Back to your todo app"
              className="admin-btn-secondary !px-3 !py-1.5 text-xs"
            >
              <MonitorSmartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">My app</span>
            </button>
            <button onClick={signOut} className="admin-btn-ghost !px-2.5 !py-1.5 text-xs" title="Log out">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>

        {/* Page outlet */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>

        <footer className="px-6 py-4 text-center text-[11px] text-slate-600">
          Admin Console · every action here is recorded in the audit log
        </footer>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-slate-950 shadow-[0_10px_30px_-8px_rgb(34_211_238/0.6)]">
        <ShieldCheck className="h-5 w-5" strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-sm font-black tracking-tight text-white">Admin Panel</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400/80">Secure Console</p>
      </div>
    </div>
  );
}

function AdminFooter({ user, role, onLogout, onGoApp }) {
  return (
    <div className="border-t border-slate-400/10 p-4">
      <div className="flex items-center gap-3 rounded-xl border border-slate-400/10 bg-slate-900/40 p-3">
        <Avatar name={user?.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{user?.name || "Admin"}</p>
          <p className="truncate text-[11px] capitalize text-slate-500">{role} session</p>
        </div>
        <button title="Log out" onClick={onLogout} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <button onClick={onGoApp} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to the todo app
      </button>
    </div>
  );
}
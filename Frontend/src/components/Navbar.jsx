import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, Bell, User, LogOut, Menu, X, CheckCircle, Archive } from "lucide-react";
import { useAuth } from "../context/useAuth";

const NAV = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/reminders", icon: Bell, label: "Reminders" },
  { to: "/archives", icon: Archive, label: "Archives" },
  { to: "/profile", icon: User, label: "Profile" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDrawerOpen(false), 0);
    return () => clearTimeout(t);
  }, [location.pathname]);

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      {/* Desktop top bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/60 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-accent-500 text-sm font-black text-white shadow-glow">
              <CheckCircle className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white hidden sm:block">SecureTodo</span>
          </NavLink>

          <nav className="hidden lg:flex items-center gap-1 ml-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-brand-500/15 text-brand-300 shadow-[inset_0_0_0_1px_rgba(116,94,246,0.25)]"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3 ml-4">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-300">{user?.name || "User"}</p>
              <p className="text-[10px] text-slate-500">{user?.email}</p>
            </div>
            <button onClick={signOut} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300" title="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setDrawerOpen(true)} className="lg:hidden ml-auto rounded-lg p-2 text-slate-300 hover:bg-white/5">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-white/10 bg-ink-900/95 backdrop-blur-xl animate-slide-in">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-accent-500 text-sm font-black text-white">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <span className="text-sm font-bold text-white">SecureTodo</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-2">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? "bg-brand-500/15 text-brand-300"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  <n.icon className="h-4.5 w-4.5" />
                  {n.label}
                </NavLink>
              ))}
            </nav>

            <div className="border-t border-white/10 p-4">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/20 text-sm font-bold text-brand-300">
                  {user?.name?.[0] || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{user?.name || "User"}</p>
                  <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
                </div>
              </div>
              <button onClick={signOut} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300">
                <LogOut className="h-3.5 w-3.5" /> Log out
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
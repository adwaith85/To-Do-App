import { useState, useEffect, useCallback } from "react";
import { User, Shield, Monitor, LogOut, X, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";
import { useAuth } from "../context/useAuth";
import { useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
import Navbar from "../components/Navbar";

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
    : /iphone|ipad/.test(s) ? "iOS"
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

export default function Profile() {
  const { user, logout, toggleTwoFactor } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const loadSessions = useCallback(() => {
    client
      .get("/api/auth/sessions")
      .then(({ data }) => setSessions(data.data?.sessions || []))
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const revokeSession = async (id) => {
    setRevokingId(id);
    try {
      const { data } = await client.delete(`/api/auth/sessions/${id}`);
      toast.success(data.message || "Device signed out");
      if (/^this device/i.test(data.message || "")) {
        await logout();
        navigate("/login", { replace: true });
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
      navigate("/login", { replace: true });
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
      e.target.checked = !enabled;
      toast.error(err.response?.data?.message || "Could not change 2FA setting");
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 animate-fade-in">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 text-brand-400">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Profile</h1>
            <p className="text-xs text-slate-400">Manage your account settings</p>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {/* Account card */}
        <section className="glass-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <User className="h-4 w-4" /> Account
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-3 py-2 border-b border-white/5">
              <span className="text-slate-500">Name</span>
              <span className="truncate font-medium text-slate-100">{user?.name}</span>
            </div>
            <div className="flex justify-between gap-3 py-2 border-b border-white/5">
              <span className="text-slate-500">Email</span>
              <span className="truncate font-medium text-slate-100">{user?.email}</span>
            </div>
            <div className="flex justify-between gap-3 py-2">
              <span className="text-slate-500">Phone</span>
              <span className="font-medium text-slate-100">{user?.phone || "Not set"}</span>
            </div>
          </div>
        </section>

        {/* Security card */}
        <section className="glass-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
            <Shield className="h-4 w-4" /> Security
          </h2>
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-semibold text-slate-100">Two-factor login</span>
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

        {/* Sessions card */}
        <section className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
              <Monitor className="h-4 w-4" /> Sessions
            </h2>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
              {sessions?.length ?? "..."} active
            </span>
          </div>

          {!sessions ? (
            <p className="py-4 text-sm text-slate-500">Loading sessions...</p>
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
                    {revokingId === s.id ? "..." : "Sign out"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button onClick={logoutAllDevices} className="btn-secondary mt-5 w-full">
            Sign out of ALL devices
          </button>
        </section>

        {/* Logout button */}
        <button
          onClick={() => setShowLogoutModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>

      {/* Logout confirmation modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogoutModal(false)} />
          <div className="relative mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900/95 backdrop-blur-xl p-6 shadow-2xl animate-slide-up">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Log out?</h3>
            <p className="text-sm text-slate-400 mb-6">You will be signed out of your current session.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={async () => {
                  setShowLogoutModal(false);
                  await logout();
                  navigate("/login", { replace: true });
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-10 pb-4 text-center text-xs text-slate-600">
        Session secured by rotating JWT tokens · logged-out tokens are permanently blacklisted
      </p>
      </div>
    </div>
  );
}
/**
 * Shared layout for every auth page (Login / Register / VerifyOtp /
 * ForgotPassword / ResetPassword).
 *
 * Professional split-screen composition:
 *   left  → brand showcase panel (aurora gradient, feature highlights)
 *   right → the form card itself
 * Collapses to a single centered card on small screens.
 */

const FEATURES = [
  {
    icon: "🔐",
    title: "Bank-grade session security",
    text: "Rotating refresh tokens, device management and instant remote sign-out.",
  },
  {
    icon: "📧",
    title: "Verified humans only",
    text: "Email OTP verification plus optional two-factor login codes.",
  },
  {
    icon: "⚡",
    title: "Built for flow",
    text: "Silent token refresh keeps you working — no surprise logouts.",
  },
];

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] shadow-2xl shadow-black/60 backdrop-blur-xl lg:grid-cols-[1.05fr_1fr]">

        {/* ── Brand showcase (desktop) ── */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-800/60 via-brand-950/80 to-ink-950 p-10 lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-accent-500/15 blur-3xl"
          />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 text-xl font-black text-white shadow-glow">
                ✓
              </div>
              <span className="text-lg font-bold tracking-tight">SecureTodo</span>
            </div>

            <h2 className="mt-12 text-3xl font-extrabold leading-tight tracking-tight">
              Stay on top of everything,
              <span className="bg-gradient-to-r from-brand-300 to-accent-400 bg-clip-text text-transparent"> worry-free.</span>
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
              Your tasks, protected by a security stack usually reserved for
              banks — so you can focus on what matters.
            </p>
          </div>

          <ul className="relative mt-12 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg">
                  {f.icon}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-100">{f.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Form side ── */}
        <main className="flex flex-col justify-center bg-ink-950/40 p-6 sm:p-10">
          {/* Compact brand mark for mobile */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-accent-500 text-base font-black text-white">
              ✓
            </div>
            <span className="font-bold tracking-tight">SecureTodo</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p>
          )}

          <div className="mt-7">{children}</div>

          {footer && (
            <div className="mt-7 border-t border-white/5 pt-5 text-center text-sm text-slate-400">
              {footer}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

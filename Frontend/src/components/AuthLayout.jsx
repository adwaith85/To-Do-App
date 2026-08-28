/**
 * Shared layout for every auth page (Login / Register / VerifyOtp /
 * ForgotPassword / ResetPassword).
 *
 * "Liquid glass" composition:
 *   - dark translucent panels (frosted glass) over animated colour blobs,
 *     deliberately neither pure black nor white
 *   - left  → brand showcase panel (glowing gradient, feature highlights)
 *   - right → the form card itself
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-8">
      {/* ── Liquid glow background ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-brand-500/30 blur-[110px] animate-liquid-glow" />
        <div className="absolute top-1/4 -right-24 h-[24rem] w-[24rem] rounded-full bg-accent-400/25 blur-[110px] animate-liquid-glow-slow" />
        <div className="absolute -bottom-40 left-1/4 h-[26rem] w-[26rem] rounded-full bg-[#e8627f]/25 blur-[120px] animate-liquid-glow" />
        <div className="absolute -bottom-20 right-1/4 h-[20rem] w-[20rem] rounded-full bg-[#fbbf24]/15 blur-[100px] animate-liquid-glow-slow" />
      </div>

      {/* ── Frosted glass card ── */}
      <div className="liquid-glass relative grid w-full max-w-5xl lg:grid-cols-[1.05fr_1fr]">

        {/* ── Brand showcase (desktop) ── */}
        <aside className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
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
              <span className="bg-gradient-to-r from-brand-300 via-accent-300 to-[#ff8fa3] bg-clip-text text-transparent">
                worry-free.
              </span>
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300/80">
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
        <main className="relative flex flex-col justify-center bg-white/[0.03] p-6 sm:p-10">
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
/**
 * Shared layout for all auth pages (Login / Register / VerifyOtp):
 * centered glass card on the app's gradient background with a brand mark.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-card max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-2xl shadow-lg shadow-indigo-500/30">
            ✓
          </div>
          <h1 className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-sm text-slate-400">{subtitle}</p>}
        </div>

        {children}

        {footer && <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>}
      </div>
    </div>
  );
}

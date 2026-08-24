/** Centered animated spinner used while auth state is booting. */
export default function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-indigo-400" />
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}

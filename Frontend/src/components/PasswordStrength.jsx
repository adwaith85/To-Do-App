/**
 * Live password strength meter powered by zxcvbn (the Dropbox estimator).
 *
 * Renders 4 segments + a verdict label + the best suggestion from the
 * scorer. Used on Register and ResetPassword so both pages share one UX.
 */
import zxcvbn from "zxcvbn";

const VERDICTS = [
  { label: "Very weak", bar: "bg-rose-500", text: "text-rose-400" },
  { label: "Weak",      bar: "bg-orange-500", text: "text-orange-400" },
  { label: "Fair",      bar: "bg-amber-400", text: "text-amber-300" },
  { label: "Strong",    bar: "bg-emerald-500", text: "text-emerald-400" },
  { label: "Excellent", bar: "bg-emerald-400", text: "text-emerald-300" },
];

export default function PasswordStrength({ password }) {
  if (!password) return null;

  const result = zxcvbn(password);
  const score = Math.min(result.score, 4); // 0–4
  const verdict = VERDICTS[score];
  const suggestion = result.feedback?.suggestions?.[0];

  return (
    <div className="mt-2.5" aria-live="polite">
      {/* Segments */}
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= score && score > 0 ? verdict.bar : "bg-white/10"
            }`}
          />
        ))}
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold ${verdict.text}`}>
          {verdict.label}
        </span>
        {suggestion && (
          <span className="truncate text-[11px] text-slate-500" title={suggestion}>
            {suggestion}
          </span>
        )}
      </div>
    </div>
  );
}

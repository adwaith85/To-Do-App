const THEMES = [
  { label: "None", value: "" },
  { label: "Light", value: "#ffffff" },
  { label: "Dark", value: "rgba(2,6,18,0.9)" },
  { label: "Love", value: "rgba(244,63,94,0.34)" },
  { label: "Simple", value: "rgba(148,163,184,0.28)" },
  { label: "Forest", value: "rgba(16,185,129,0.32)" },
  { label: "Ocean", value: "rgba(56,189,248,0.32)" },
  { label: "Sunset", value: "rgba(251,146,60,0.34)" },
  { label: "Violet", value: "rgba(167,139,250,0.32)" },
];

const swatch = {
  None: "repeating-linear-gradient(45deg,rgba(148,163,184,0.85) 0 2px,transparent 2px 6px)",
  Light: "linear-gradient(135deg,#ffffff 50%,#e2e8f0 50%)",
  Dark: "linear-gradient(135deg,#02060e 50%,#0f1a2e 50%)",
  Love: "linear-gradient(135deg,#f43f5e,#be123c)",
  Simple: "linear-gradient(135deg,#94a3b8,#475569)",
  Forest: "linear-gradient(135deg,#10b981,#065f46)",
  Ocean: "linear-gradient(135deg,#38bdf8,#075985)",
  Sunset: "linear-gradient(135deg,#fb923c,#ea580c)",
  Violet: "linear-gradient(135deg,#a78bfa,#6d28d9)",
};

export default function ThemePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {THEMES.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => onChange(t.value)}
          title={t.label}
          className={`h-7 w-7 rounded-full border-2 transition-all duration-200 ${
            value === t.value
              ? "border-brand-400 scale-110 shadow-[0_0_0_3px_rgba(116,94,246,0.2)]"
              : "border-white/15 hover:border-white/40 hover:scale-105"
          }`}
          style={{ background: swatch[t.label] }}
          aria-label={`Theme: ${t.label}`}
        />
      ))}
    </div>
  );
}

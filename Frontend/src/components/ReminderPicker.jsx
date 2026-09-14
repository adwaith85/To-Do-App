import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Bell, AlarmClock, Trash2 } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MINUTE_STEP = 5;

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const pad = (n) => String(n).padStart(2, "0");

/**
 * Small scrollable "wheel" lane used for hours / minutes.
 * Selected value is auto-centered, edges fade out, a glass guide band
 * marks the active row. Pure CSS/JS — no external picker lib.
 */
function WheelLane({ items, value, onSelect, format = (v) => v, light }) {
  const ref = useRef(null);
  const ITEM = 36;
  const PAD = 44;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = items.findIndex((it) => it === value);
    if (idx < 0) return;
    const center = (el.clientHeight - ITEM) / 2;
    el.scrollTo({ top: Math.max(0, PAD + idx * ITEM - center), behavior: "auto" });
  }, [value, items]);

  return (
    <div className="relative h-[136px] w-14 shrink-0">
      <div
        ref={ref}
        className="no-scrollbar h-full overflow-y-auto"
        style={{
          paddingTop: PAD,
          paddingBottom: PAD,
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 28%, black 70%, transparent)",
          maskImage:
            "linear-gradient(to bottom, transparent, black 28%, black 70%, transparent)",
        }}
      >
        <div className="flex flex-col items-center">
          {items.map((it) => {
            const sel = it === value;
            return (
              <button
                key={it}
                type="button"
                onClick={() => onSelect(it)}
                className={`flex h-9 w-11 items-center justify-center rounded-xl text-sm font-semibold transition ${
                  sel
                    ? "bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-glow"
                    : light
                      ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {format(String(it).padStart(2, "0"))}
              </button>
            );
          })}
        </div>
      </div>
      <div
        className={`pointer-events-none absolute inset-x-0.5 top-1/2 h-9 -translate-y-1/2 rounded-xl border ${
          light
            ? "border-brand-500/20 bg-brand-500/[0.05]"
            : "border-brand-400/20 bg-brand-400/[0.06]"
        }`}
      />
    </div>
  );
}

export default function ReminderPicker({ value, onChange, onDone, light = false }) {
  const now = new Date();
  const [viewDate, setViewDate] = useState(() => {
    const d = value ? new Date(value) : now;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = value ? new Date(value) : null;
    return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null;
  });
  const [hour, setHour] = useState(() => {
    if (!value) return 12;
    const h = new Date(value).getHours() % 12;
    return h === 0 ? 12 : h;
  });
  const [minute, setMinute] = useState(() => {
    if (!value) return 0;
    return new Date(value).getMinutes();
  });
  const [ampm, setAmpm] = useState(() => {
    if (!value) return "AM";
    return new Date(value).getHours() >= 12 ? "PM" : "AM";
  });

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  useEffect(() => {
    emit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, hour, minute, ampm]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onDone?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const buildDate = () => {
    if (!selectedDate) return null;
    const base = new Date(selectedDate);
    base.setHours(0, 0, 0, 0);
    const h24 = ampm === "PM" ? (hour % 12) + 12 : hour % 12;
    base.setHours(h24, minute, 0, 0);
    return base;
  };

  function emit() {
    const d = buildDate();
    if (!d) {
      onChange("");
      return;
    }
    if (d.getTime() <= Date.now()) {
      onChange("");
      return;
    }
    // Output as a naive local string consistent with datetime-local.
    onChange(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }

  const selectDay = (day) => {
    const d = new Date(y, m, day);
    if (d.getTime() < todayStart.getTime()) return;
    setSelectedDate(
      day === selectedDate?.getDate() && m === selectedDate?.getMonth() ? null : d
    );
  };

  const prevMonth = () => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    const min = new Date(today.getFullYear(), today.getMonth(), 1);
    if (d < min) return;
    setViewDate(d);
  };

  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const picked = buildDate();
  const selectedTimeIsPast = picked ? picked.getTime() <= Date.now() : false;

  const applyPreset = (target) => {
    const d = new Date(target);
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    const h = d.getHours() % 12;
    setHour(h === 0 ? 12 : h);
    setMinute(d.getMinutes());
    setAmpm(d.getHours() >= 12 ? "PM" : "AM");
  };

  const PRESETS = [
    { label: "+30 min", date: () => new Date(Date.now() + 30 * 60 * 1000) },
    { label: "+1 hour", date: () => new Date(Date.now() + 60 * 60 * 1000) },
    {
      label: "Tonight",
      date: () => {
        const d = new Date();
        if (d.getHours() >= 20) d.setDate(d.getDate() + 1);
        d.setHours(20, 0, 0, 0);
        return d;
      },
    },
    {
      label: "Tom. 9 AM",
      date: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
  ];

  const minuteItems = Array.from(
    { length: Math.ceil(60 / MINUTE_STEP) },
    (_, i) => i * MINUTE_STEP
  ).filter((v) => v < 60);
  if (!minuteItems.includes(minute)) minuteItems.push(minute);
  minuteItems.sort((a, b) => a - b);

  const confirm = () => {
    if (!selectedDate || selectedTimeIsPast) return;
    emit();
    onDone?.();
  };

  const clear = () => {
    setSelectedDate(null);
    setHour(12);
    setMinute(0);
    setAmpm("AM");
    onChange("");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Click-away backdrop */}
      <div className="absolute inset-0" onClick={onDone} />

      <div
        className={`animate-slide-up relative m-3 w-full max-w-[23rem] max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-2xl border shadow-2xl ${
          light ? "border-slate-200 bg-white shadow-black/10" : "border-white/10 bg-ink-900/95 shadow-black/50"
        }`}
      >
        {/* Aurora sync accent strip */}
        <div className="h-1 w-full bg-gradient-to-r from-brand-500 via-brand-400 to-accent-500" />

        {/* Header */}
        <div className={`flex items-center justify-between px-4 pt-3 ${light ? "text-slate-900" : "text-white"}`}>
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${light ? "bg-accent-500/10 text-accent-600" : "bg-accent-400/10 text-accent-300"}`}>
              <Bell className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-bold">Set reminder</span>
          </div>
          <button
            type="button"
            onClick={onDone}
            className={`rounded-lg p-1 transition ${light ? "text-slate-400 hover:bg-slate-100 hover:text-slate-700" : "text-slate-500 hover:bg-white/10 hover:text-white"}`}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 pb-4 pt-3">
          {/* Preview of the current pick */}
          {selectedDate && picked && !selectedTimeIsPast && (
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${light ? "border-accent-500/25 bg-accent-500/[0.06] text-accent-700" : "border-accent-400/25 bg-accent-400/[0.07] text-accent-300"}`}>
              <AlarmClock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                Reminder ·{" "}
                {picked.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{" "}
                · {picked.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          )}

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.date())}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                  light
                    ? "border-slate-200 bg-slate-50 text-slate-600 hover:border-accent-500/40 hover:bg-accent-500/10 hover:text-accent-700"
                    : "border-white/10 bg-white/5 text-slate-400 hover:border-accent-400/40 hover:bg-accent-400/10 hover:text-accent-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className={`rounded-xl border p-2.5 ${light ? "border-slate-200 bg-slate-50/60" : "border-white/5 bg-white/[0.02]"}`}>
            {/* Month nav */}
            <div className="mb-1.5 flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                disabled={viewDate <= new Date(today.getFullYear(), today.getMonth(), 1)}
                className={`rounded-md px-2 py-0.5 text-[11px] transition ${
                  light ? "text-slate-500 hover:bg-slate-200 hover:text-slate-800" : "text-slate-400 hover:bg-white/10 hover:text-white"
                } disabled:cursor-not-allowed disabled:opacity-30`}
              >
                ‹
              </button>
              <span className={`text-xs font-bold ${light ? "text-slate-800" : "text-slate-200"}`}>
                {MONTHS[m]} {y}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className={`rounded-md px-2 py-0.5 text-[11px] transition ${light ? "text-slate-500 hover:bg-slate-200 hover:text-slate-800" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
              >
                ›
              </button>
            </div>

            {/* Weekday header */}
            <div className="mb-1 grid grid-cols-7 gap-1 text-center">
              {DOW.map((d) => (
                <span key={d} className={`text-[9px] font-bold uppercase tracking-wide ${light ? "text-slate-400" : "text-slate-500"}`}>
                  {d}
                </span>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <span key={`e${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const d = new Date(y, m, day);
                const isPast = d.getTime() < todayStart.getTime();
                const isSel = selectedDate && sameDay(d, selectedDate);
                const isTod = sameDay(d, today);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDay(day)}
                    disabled={isPast}
                    className={`flex h-7 items-center justify-center rounded-lg text-[11px] font-semibold transition ${
                      isSel
                        ? "bg-gradient-to-br from-brand-500 to-accent-500 text-white font-bold shadow-glow"
                        : isTod
                          ? light
                            ? "text-brand-600 ring-1 ring-brand-500/40"
                            : "text-brand-300 ring-1 ring-brand-400/30"
                          : isPast
                            ? light
                              ? "text-slate-300 cursor-not-allowed"
                              : "text-slate-700 cursor-not-allowed"
                            : light
                              ? "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                              : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time */}
          <div className={`rounded-xl border p-2.5 ${light ? "border-slate-200 bg-slate-50/60" : "border-white/5 bg-white/[0.02]"}`}>
            <div className={`mb-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider ${light ? "text-slate-400" : "text-slate-500"}`}>
              Time
            </div>
            <div className={`flex items-center justify-center gap-2 ${!selectedDate ? "pointer-events-none opacity-40" : ""}`}>
              <WheelLane
                items={Array.from({ length: 12 }, (_, i) => i + 1)}
                value={hour}
                onSelect={setHour}
                format={(v) => v}
                light={light}
              />
              <span className={`text-sm font-bold ${light ? "text-slate-300" : "text-slate-600"}`}>:</span>
              <WheelLane
                items={minuteItems}
                value={minute}
                onSelect={setMinute}
                light={light}
              />
              <div className="flex w-12 flex-col gap-1.5 self-stretch py-1">
                {["AM", "PM"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmpm(p)}
                    className={`flex-1 rounded-xl text-[11px] font-bold transition ${
                      ampm === p
                        ? "bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-glow"
                        : light
                          ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          : "bg-white/5 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedDate && selectedTimeIsPast && (
            <p className="text-[10px] font-medium text-rose-400">
              Choose a future time — the reminder time can&apos;t be in the past.
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t pt-3" style={light ? { borderColor: "rgb(226 232 240)" } : { borderColor: "rgb(255 255 255 / 0.06)" }}>
            {value ? (
              <button
                type="button"
                onClick={clear}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                  light
                    ? "text-rose-600 hover:bg-rose-500/10"
                    : "text-rose-400 hover:bg-rose-500/10"
                }`}
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={confirm}
              disabled={!selectedDate || selectedTimeIsPast}
              className="rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 px-5 py-2 text-[11px] font-bold text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
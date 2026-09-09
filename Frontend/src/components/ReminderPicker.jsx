import { useState, useEffect } from "react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function ReminderPicker({ value, onChange, onDone }) {
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
    const d = new Date(value);
    const h = d.getHours() % 12;
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

  const emit = () => {
    if (!selectedDate) {
      onChange("");
      return;
    }
    // Build a date in the user's local time at midnight, then add time.
    const base = new Date(selectedDate);
    base.setHours(0, 0, 0, 0);
    const h24 = ampm === "PM" ? (hour % 12) + 12 : hour % 12;
    base.setHours(h24, minute, 0, 0);
    if (base.getTime() <= Date.now()) {
      onChange("");
      return;
    }
    // Output as a naive local string in YYYY-MM-DDTHH:mm so the backend
    // interprets it as server-relative consistent with datetime-local.
    const pad = (n) => String(n).padStart(2, "0");
    onChange(
      `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`
    );
  };

  const selectDay = (day) => {
    const d = new Date(y, m, day);
    // Disallow past days
    if (d.getTime() < todayStart.getTime()) return;
    setSelectedDate(day === selectedDate?.getDate() && m === selectedDate?.getMonth() ? null : d);
  };

  const prevMonth = () => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    const min = new Date(today.getFullYear(), today.getMonth(), 1);
    if (d < min) return;
    setViewDate(d);
  };

  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const timeDisabled = !selectedDate;

  // Future validity of the currently chosen date+time (for today's date).
  const selectedTimeIsPast = (() => {
    if (!selectedDate) return false;
    const base = new Date(selectedDate);
    base.setHours(0, 0, 0, 0);
    const h24 = ampm === "PM" ? (hour % 12) + 12 : hour % 12;
    base.setHours(h24, minute, 0, 0);
    return base.getTime() <= Date.now();
  })();

  const confirm = () => {
    if (!selectedDate) return;
    if (selectedTimeIsPast) return;
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

  return (
    <div className="w-full rounded-xl border border-white/10 bg-ink-900/85 shadow-xl shadow-black/20 backdrop-blur-xl p-3">
      {/* Calendar header */}
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-white" disabled={viewDate <= new Date(today.getFullYear(), today.getMonth(), 1)}>
          ‹
        </button>
        <span className="text-xs font-semibold text-slate-200">
          {MONTHS[m]} {y}
        </span>
        <button type="button" onClick={nextMonth} className="rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-white">
          ›
        </button>
      </div>

      {/* Week header */}
      <div className="mb-1 grid grid-cols-7 gap-1 text-center">
        {DOW.map((d) => (
          <span key={d} className="text-[10px] font-semibold text-slate-500">{d}</span>
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
              className={`h-7 rounded-md text-[11px] transition ${
                isSel
                  ? "bg-brand-500 text-white font-bold"
                  : isTod
                    ? "text-brand-300 ring-1 ring-brand-400/30"
                    : isPast
                      ? "text-slate-700 cursor-not-allowed"
                      : "text-slate-300 hover:bg-white/10"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Time row */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Time</span>
        <div className={`flex items-center gap-1.5 ${timeDisabled ? "opacity-40 pointer-events-none" : ""}`}>
          <select
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-1.5 py-1 text-xs text-slate-200 outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <span className="text-xs text-slate-600">:</span>
          <select
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-1.5 py-1 text-xs text-slate-200 outline-none"
          >
            {Array.from({ length: 60 }, (_, i) => i).map((mi) => (
              <option key={mi} value={mi}>{String(mi).padStart(2, "0")}</option>
            ))}
          </select>
          <div className="flex flex-col">
            {["AM", "PM"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmpm(p)}
                className={`rounded px-1.5 text-[10px] font-bold transition ${
                  ampm === p ? "bg-brand-500 text-white" : "text-slate-400 hover:bg-white/10"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {value && (
          <button
            type="button"
            onClick={clear}
            className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-rose-400 hover:bg-rose-500/10"
          >
            Clear
          </button>
        )}
      </div>

      {selectedDate && selectedTimeIsPast && (
        <p className="mt-2 text-[10px] font-medium text-rose-400">
          Choose a future time — the reminder time can&apos;t be in the past.
        </p>
      )}

      <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/5 pt-2.5">
        <button
          type="button"
          onClick={confirm}
          disabled={!selectedDate || selectedTimeIsPast}
          className="rounded-lg bg-brand-500 px-4 py-1.5 text-[11px] font-bold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Done
        </button>
      </div>
    </div>
  );
}

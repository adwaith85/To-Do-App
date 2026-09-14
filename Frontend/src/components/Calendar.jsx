import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDateStr = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

export default function Calendar({ todos = [], onDateClick, selectedDate }) {
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const now = new Date();
  const todayStr = toDateStr(now);

  const marks = new Map();
  const touch = (dateStr) => {
    if (!marks.has(dateStr)) marks.set(dateStr, { pending: false, pastDue: false, completed: false, due: false });
    return marks.get(dateStr);
  };

  todos.forEach((t) => {
    if (t.dueDate) touch(toDateStr(t.dueDate)).due = true;
    if (!t.reminderAt) return;
    const mark = touch(toDateStr(t.reminderAt));
    if (t.status === "completed") mark.completed = true;
    else if (new Date(t.reminderAt) <= now) mark.pastDue = true;
    else mark.pending = true;
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = () => setViewDate(new Date(year, month - 1, 1));
  const next = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prev} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-bold text-white">
          {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h3>
        <button onClick={next} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DAYS.map((d) => (
          <div key={d} className="py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const m = marks.get(dateStr);
          const hasReminderMark = m && (m.pending || m.pastDue || m.completed);
          const hasDueMark = m && m.due;

          return (
            <button
              key={dateStr}
              onClick={() => onDateClick?.(dateStr)}
              className={`relative flex h-8 w-full items-center justify-center rounded-lg text-xs font-medium transition-all duration-150 ${
                isSelected
                  ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
                  : isToday
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {day}
              {hasReminderMark && (
                <span className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 items-center gap-0.5">
                  {m.pending && <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-brand-400"}`} />}
                  {m.pastDue && <span className="h-1 w-1 rounded-full bg-rose-400" />}
                  {m.completed && <span className="h-1 w-1 rounded-full bg-emerald-400" />}
                </span>
              )}
              {!hasReminderMark && hasDueMark && (
                <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-slate-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 pt-2.5">
        <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Upcoming
        </span>
        <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Past due
        </span>
        <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Done
        </span>
      </div>
    </div>
  );
}
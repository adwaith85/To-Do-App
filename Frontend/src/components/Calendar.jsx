import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar({ todos = [], onDateClick, selectedDate }) {
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const todoDates = new Set();
  const reminderDates = new Set();
  todos.forEach((t) => {
    if (t.dueDate) todoDates.add(new Date(t.dueDate).toISOString().slice(0, 10));
    if (t.reminderAt) reminderDates.add(new Date(t.reminderAt).toISOString().slice(0, 10));
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
          const hasTodo = todoDates.has(dateStr);
          const hasReminder = reminderDates.has(dateStr);

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
              {(hasTodo || hasReminder) && (
                <span className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${hasReminder ? "bg-accent-400" : "bg-brand-400"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
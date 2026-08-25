import { useMemo } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { vi } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDayMonthRange } from "@/lib/formatDateVi";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

interface MonthBoundCalendarProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  selected: Date;
  rangeStart: Date;
  rangeEnd: Date;
  onSelect: (day: Date) => void;
}

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function MonthBoundCalendar({
  month,
  onMonthChange,
  selected,
  rangeStart,
  rangeEnd,
  onSelect,
}: MonthBoundCalendarProps) {
  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const spanStart = dayKey(rangeStart) <= dayKey(rangeEnd) ? rangeStart : rangeEnd;
  const spanEnd = dayKey(rangeStart) <= dayKey(rangeEnd) ? rangeEnd : rangeStart;

  return (
    <div className="w-[min(100vw-2rem,20rem)] select-none p-3" data-no-double-tap>
      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:scale-95"
          aria-label="Tháng trước"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <p className="min-w-0 flex-1 truncate text-center font-display text-base capitalize leading-tight">
          {format(month, "MMMM yyyy", { locale: vi })}
        </p>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:scale-95"
          aria-label="Tháng sau"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>

      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-muted/30 p-2.5 shadow-warm">
        <div className="mb-1.5 grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map(d => (
            <div
              key={d}
              className="py-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {gridDays.map(day => {
            const inMonth = isSameMonth(day, month);
            const weekend = getDay(day) === 0 || getDay(day) === 6;
            const picked = isSameDay(day, selected);
            const otherEnd =
              !picked && (isSameDay(day, rangeStart) || isSameDay(day, rangeEnd));
            const key = dayKey(day);
            const inSpan = key >= dayKey(spanStart) && key <= dayKey(spanEnd);
            const today = isToday(day);
            const monthBreak = day.getDate() === 1 && !isSameMonth(day, month);

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onSelect(day)}
                aria-label={format(day, "PPP", { locale: vi })}
                aria-pressed={picked}
                className={[
                  "relative flex aspect-square items-center justify-center text-sm tabular-nums",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  !inMonth && "text-muted-foreground/35",
                  inMonth && weekend && !picked && "text-[var(--weekend-ink)]",
                  inMonth && inSpan && !picked && !otherEnd && "text-foreground/80",
                  otherEnd && "font-medium",
                  picked && "rounded-xl bg-[#efe4d2] font-semibold text-foreground",
                  today && !picked && "font-medium text-primary",
                  "hover:text-foreground active:scale-95",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {format(day, "d")}
                {monthBreak && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[7px] uppercase tracking-tighter text-muted-foreground/80">
                    {format(day, "MMM", { locale: vi })}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-2.5 text-center text-[10px] text-muted-foreground">
          {formatDayMonthRange(spanStart, spanEnd)}
          <span className="mx-1.5 text-border">·</span>
          {format(spanEnd, "yyyy")}
        </p>
      </div>
    </div>
  );
}

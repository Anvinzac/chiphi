import { useMemo } from "react";
import {
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { vi } from "date-fns/locale";

interface RangeDayPickerProps {
  rangeStart: Date;
  rangeEnd: Date;
  selected?: Date;
  onSelect: (date: Date) => void;
  onViewRange?: () => void;
}

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export default function RangeDayPicker({
  rangeStart,
  rangeEnd,
  selected,
  onSelect,
  onViewRange,
}: RangeDayPickerProps) {
  const daysInRange = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd]
  );

  // Pad to full weeks so the grid aligns (Mon–Sun)
  const gridDays = useMemo(() => {
    const start = startOfWeek(rangeStart, { weekStartsOn: 1 });
    const end = endOfWeek(rangeEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [rangeStart, rangeEnd]);

  const monthLabels = useMemo(() => {
    const labels: { key: string; label: string }[] = [];
    daysInRange.forEach(day => {
      const key = format(day, "yyyy-MM");
      if (!labels.some(l => l.key === key)) {
        labels.push({
          key,
          label: format(day, "MMMM yyyy", { locale: vi }),
        });
      }
    });
    return labels;
  }, [daysInRange]);

  const isInRange = (day: Date) => {
    const key = format(day, "yyyy-MM-dd");
    return key >= format(rangeStart, "yyyy-MM-dd") && key <= format(rangeEnd, "yyyy-MM-dd");
  };

  return (
    <div className="w-[min(100vw-2rem,20rem)] select-none" data-no-double-tap>
      <div className="flex items-center justify-between gap-2 px-1 pb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Trong kỳ
          </p>
          <p className="font-display text-base leading-tight truncate capitalize">
            {monthLabels.map(m => m.label).join(" · ")}
          </p>
        </div>
        {onViewRange && (
          <button
            type="button"
            onClick={onViewRange}
            className="shrink-0 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
          >
            Toàn kỳ
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-muted/30 p-3 shadow-warm">
        <div className="mb-2 grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map(d => (
            <div
              key={d}
              className="py-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {gridDays.map(day => {
            const inRange = isInRange(day);
            const selectedDay = selected && isSameDay(day, selected);
            const today = isToday(day);
            const monthBreak =
              inRange &&
              !isSameDay(day, rangeStart) &&
              day.getDate() === 1;

            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={!inRange}
                onClick={() => inRange && onSelect(day)}
                aria-label={format(day, "PPP", { locale: vi })}
                aria-pressed={!!selectedDay}
                className={[
                  "relative aspect-square rounded-xl text-sm tabular-nums transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !inRange && "cursor-default text-transparent",
                  inRange && !selectedDay && "text-foreground hover:bg-primary/10 active:scale-95",
                  selectedDay &&
                    "bg-primary text-primary-foreground shadow-md font-semibold",
                  inRange && today && !selectedDay && "ring-1 ring-primary/40 font-medium",
                  monthBreak && !selectedDay && "bg-muted/50",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {inRange ? format(day, "d") : ""}
                {monthBreak && inRange && (
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[7px] uppercase tracking-tighter text-muted-foreground/80">
                    {format(day, "MMM", { locale: vi })}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          {format(rangeStart, "d MMM", { locale: vi })}
          {" – "}
          {format(rangeEnd, "d MMM yyyy", { locale: vi })}
          <span className="mx-1.5 text-border">·</span>
          {daysInRange.length} ngày
        </p>
      </div>
    </div>
  );
}

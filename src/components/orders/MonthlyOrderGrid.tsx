import { useMemo } from "react";
import { eachDayOfInterval, format, getDay, isSameDay } from "date-fns";
import { vi } from "date-fns/locale";
import type { MonthlyOrderLine } from "@/lib/mockMonthlyOrderGrid";

export type MonthlyOrderCol = 2 | 3 | 4;

interface MonthlyOrderGridProps {
  rangeStart: Date;
  rangeEnd: Date;
  columns: MonthlyOrderCol;
  itemsByDate: Map<string, MonthlyOrderLine[]>;
  todayStr: string;
  onSelectDay?: (dateStr: string) => void;
}

function lineLabel(line: MonthlyOrderLine): string {
  return line.num;
}

export default function MonthlyOrderGrid({
  rangeStart,
  rangeEnd,
  columns,
  itemsByDate,
  todayStr,
  onSelectDay,
}: MonthlyOrderGridProps) {
  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd],
  );

  const rowCount = Math.max(1, Math.ceil(days.length / columns));
  const padCount = rowCount * columns - days.length;

  return (
    <div
      key={`${columns}-${format(rangeStart, "yyyy-MM-dd")}-${format(rangeEnd, "yyyy-MM-dd")}`}
      className="order-month-grid"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
      }}
      data-no-double-tap
    >
      {days.map(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const lines = itemsByDate.get(dateStr) ?? [];
        const weekend = getDay(day) === 0 || getDay(day) === 6;
        const isFuture = dateStr > todayStr;
        const isToday = dateStr === todayStr;
        const monthBreak = day.getDate() === 1 && !isSameDay(day, rangeStart);
        const hasLines = lines.length > 0;

        const inner = (
          <>
            <span className={`order-month-day ${weekend ? "order-month-day-weekend" : ""}`}>
              {format(day, "d")}
              {monthBreak && (
                <span className="order-month-month">{format(day, "MMM", { locale: vi })}</span>
              )}
            </span>

            <div className="order-month-lines">
              {!hasLines ? (
                <span className="order-month-empty">—</span>
              ) : (
                <span className="order-month-num">{lines[0].num}</span>
              )}
            </div>
          </>
        );

        if (isFuture) {
          return (
            <div
              key={dateStr}
              className={`order-month-cell order-month-cell-future ${weekend ? "order-month-cell-weekend" : ""} ${columns === 2 ? "order-month-cell-2" : columns === 3 ? "order-month-cell-3" : "order-month-cell-4"}`}
              aria-label={`${format(day, "PPP", { locale: vi })} · chưa tới`}
            >
              {inner}
            </div>
          );
        }

        if (!onSelectDay) {
          return (
            <div
              key={dateStr}
              className={[
                "order-month-cell",
                weekend && "order-month-cell-weekend",
                isToday && "order-month-cell-today",
                columns === 2 ? "order-month-cell-2" : columns === 3 ? "order-month-cell-3" : "order-month-cell-4",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {inner}
            </div>
          );
        }

        return (
          <button
            key={dateStr}
            type="button"
            onClick={() => onSelectDay(dateStr)}
            aria-label={`${format(day, "PPP", { locale: vi })} · ${hasLines ? lines.map(lineLabel).join(", ") : "không có món"}`}
            className={[
              "order-month-cell",
              weekend && "order-month-cell-weekend",
              isToday && "order-month-cell-today",
              columns === 2 ? "order-month-cell-2" : columns === 3 ? "order-month-cell-3" : "order-month-cell-4",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {inner}
          </button>
        );
      })}
      {Array.from({ length: padCount }, (_, i) => (
        <div
          key={`pad-${i}`}
          className={`order-month-cell order-month-cell-pad ${columns === 2 ? "order-month-cell-2" : columns === 3 ? "order-month-cell-3" : "order-month-cell-4"}`}
          aria-hidden
        />
      ))}
    </div>
  );
}

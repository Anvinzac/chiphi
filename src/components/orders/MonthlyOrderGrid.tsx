import { useMemo } from "react";
import { eachDayOfInterval, endOfWeek, format, getDay, isSameDay, startOfWeek } from "date-fns";
import { vi } from "date-fns/locale";
import type { MonthlyOrderLine } from "@/lib/mockMonthlyOrderGrid";

export type MonthlyOrderCol = 2 | 3 | 4 | 7;

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function cellDensity(columns: MonthlyOrderCol) {
  return `order-month-cell-${columns}`;
}

interface MonthlyOrderGridProps {
  rangeStart: Date;
  rangeEnd: Date;
  columns: MonthlyOrderCol;
  itemsByDate: Map<string, MonthlyOrderLine[]>;
  todayStr: string;
  onSelectDay?: (info: { dateStr: string; rect: DOMRect; row: number; col: number; columns: number }) => void;
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
  const weekAligned = columns === 7;
  const rangeStartKey = format(rangeStart, "yyyy-MM-dd");
  const rangeEndKey = format(rangeEnd, "yyyy-MM-dd");
  const density = cellDensity(columns);

  const days = useMemo(() => {
    if (weekAligned) {
      return eachDayOfInterval({
        start: startOfWeek(rangeStart, { weekStartsOn: 1 }),
        end: endOfWeek(rangeEnd, { weekStartsOn: 1 }),
      });
    }
    return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  }, [rangeStart, rangeEnd, weekAligned]);

  const rowCount = Math.max(1, Math.ceil(days.length / columns));
  const padCount = weekAligned ? 0 : rowCount * columns - days.length;

  const grid = (
    <div
      key={`${columns}-${rangeStartKey}-${rangeEndKey}`}
      className="order-month-grid"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
      }}
      data-no-double-tap
    >
      {days.map((day, idx) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const outOfRange = weekAligned && (dateStr < rangeStartKey || dateStr > rangeEndKey);
        const lines = outOfRange ? [] : itemsByDate.get(dateStr) ?? [];
        const weekend = getDay(day) === 0 || getDay(day) === 6;
        const isFuture = dateStr > todayStr;
        const isToday = dateStr === todayStr;
        const monthBreak = day.getDate() === 1 && !isSameDay(day, rangeStart);
        const hasLines = lines.length > 0;
        const row = Math.floor(idx / columns);
        const col = idx % columns;

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

        const className = [
          "order-month-cell",
          density,
          weekend && "order-month-cell-weekend",
          isToday && !outOfRange && "order-month-cell-today",
          isFuture && "order-month-cell-future",
          outOfRange && "order-month-cell-outofrange",
        ]
          .filter(Boolean)
          .join(" ");

        if (outOfRange || isFuture || !onSelectDay) {
          return (
            <div
              key={dateStr}
              className={className}
              aria-label={`${format(day, "PPP", { locale: vi })}${outOfRange ? " · ngoài khoảng" : isFuture ? " · chưa tới" : ""}`}
            >
              {inner}
            </div>
          );
        }

        return (
          <button
            key={dateStr}
            type="button"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              onSelectDay({ dateStr, rect, row, col, columns });
            }}
            aria-label={`${format(day, "PPP", { locale: vi })} · ${hasLines ? lines.map(lineLabel).join(", ") : "không có món"}`}
            className={className}
          >
            {inner}
          </button>
        );
      })}
      {Array.from({ length: padCount }, (_, i) => (
        <div key={`pad-${i}`} className={`order-month-cell order-month-cell-pad ${density}`} aria-hidden />
      ))}
    </div>
  );

  if (!weekAligned) return grid;

  return (
    <div className="order-month-week-wrap">
      <div className="order-month-weekdays" aria-hidden>
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`order-month-weekday ${i >= 5 ? "order-month-weekday-weekend" : ""}`}>
            {d}
          </div>
        ))}
      </div>
      {grid}
    </div>
  );
}

import { useEffect, useRef, useState, useMemo } from "react";
import { addDays, eachDayOfInterval, endOfWeek, format, getDay, isSameDay, startOfWeek } from "date-fns";
import { vi } from "date-fns/locale";
import type { MonthlyOrderLine } from "@/lib/mockMonthlyOrderGrid";

interface Props {
  rangeStart: Date;
  rangeEnd: Date;
  itemsByDate: Map<string, MonthlyOrderLine[]>;
  todayStr: string;
  onSelectDay?: (info: { dateStr: string; rect: DOMRect; row: number; col: number; columns: number }) => void;
}

function shortRange(a: Date, b: Date): string {
  // e.g. "4 th 8 – 10 th 8"
  return `${format(a, "d 'th' M")} – ${format(b, "d 'th' M")}`;
}

export default function MonthlyOrderTwoColPager({
  rangeStart,
  rangeEnd,
  itemsByDate,
  todayStr,
  onSelectDay,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const rangeStartKey = format(rangeStart, "yyyy-MM-dd");
  const rangeEndKey = format(rangeEnd, "yyyy-MM-dd");

  const weeks = useMemo(() => {
    const ws = startOfWeek(rangeStart, { weekStartsOn: 1 });
    const we = endOfWeek(rangeEnd, { weekStartsOn: 1 });
    const list: { start: Date; end: Date }[] = [];
    let cur = ws;
    while (cur <= we) {
      const end = addDays(cur, 6);
      list.push({ start: cur, end });
      cur = addDays(cur, 7);
    }
    return list;
  }, [rangeStart, rangeEnd]);

  const pages = useMemo(() => {
    const out: (typeof weeks)[] = [];
    for (let i = 0; i < weeks.length; i += 2) out.push(weeks.slice(i, i + 2));
    return out;
  }, [weeks]);

  useEffect(() => {
    setActive(0);
    scrollerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [pages.length, pages[0]?.[0]?.start?.toISOString()]);

  const settleActive = () => {
    const el = scrollerRef.current;
    if (!el || el.clientHeight === 0) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    const clamped = Math.max(0, Math.min(pages.length - 1, idx));
    setActive(clamped);
  };

  const goTo = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: idx * el.clientHeight, behavior: "smooth" });
    setActive(idx);
  };

  if (pages.length === 0) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {pages.length > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-background/95 px-1 py-2">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Trang tuần">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                onClick={() => goTo(i)}
                aria-label={`Trang ${i + 1}`}
                aria-selected={i === active}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === active ? "w-5 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            {active + 1}/{pages.length}
          </span>
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={settleActive}
        onTouchEnd={settleActive}
        className="monthly-two-col-scroller flex-1 overflow-y-auto overscroll-contain"
        style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {pages.map((pageWeeks, pageIdx) => (
          <div
            key={pageIdx}
            className="monthly-two-col-page"
            style={{ scrollSnapAlign: "start", scrollSnapStop: "always" } as React.CSSProperties}
          >
            <div className="monthly-two-col-grid">
              {pageWeeks.map((week, colIdx) => (
                <div key={week.start.toISOString()} className="monthly-two-col-week">
                  <div className="monthly-two-col-week-head">
                    {shortRange(week.start, week.end)}
                  </div>
                  <div className="monthly-two-col-week-body">
                    {eachDayOfInterval({ start: week.start, end: week.end }).map((day, dayIdx) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const outOfRange = dateStr < rangeStartKey || dateStr > rangeEndKey;
                      const lines = outOfRange ? [] : itemsByDate.get(dateStr) ?? [];
                      const hasNum = lines.length > 0 && !outOfRange;
                      const weekend = getDay(day) === 0 || getDay(day) === 6;
                      const isFuture = dateStr > todayStr;
                      const isToday = dateStr === todayStr;
                      const monthBreak = day.getDate() === 1 && !isSameDay(day, rangeStart);
                      const row = dayIdx;
                      const col = colIdx;
                      const columns = 2;

                      const inner = (
                        <>
                          <span className={`order-month-day ${weekend ? "order-month-day-weekend" : ""}`}>
                            {format(day, "d")}
                            {monthBreak && (
                              <span className="order-month-month">{format(day, "MMM", { locale: vi })}</span>
                            )}
                          </span>
                          <div className="order-month-lines">
                            {!hasNum ? <span className="order-month-empty">—</span> : <span className="order-month-num">{lines[0].num}</span>}
                          </div>
                        </>
                      );

                      const baseClass = [
                        "order-month-cell",
                        weekend && "order-month-cell-weekend",
                        isToday && "order-month-cell-today",
                        isFuture && "order-month-cell-future",
                        outOfRange && "order-month-cell-outofrange",
                      ]
                        .filter(Boolean)
                        .join(" ");

                      if (outOfRange || isFuture) {
                        return (
                          <div key={dateStr} className={baseClass} aria-label={`${format(day, "PPP", { locale: vi })} · ngoài khoảng`}>
                            {inner}
                          </div>
                        );
                      }
                      if (!onSelectDay) {
                        return (
                          <div key={dateStr} className={baseClass}>
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
                          aria-label={`${format(day, "PPP", { locale: vi })} · ${hasNum ? lines[0].num : "không có số"}`}
                          className={baseClass}
                        >
                          {inner}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {pageWeeks.length === 1 && <div className="monthly-two-col-week monthly-two-col-week-pad" aria-hidden />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

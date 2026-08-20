import { useMemo } from "react";
import { eachDayOfInterval, format, getDay, isSameDay } from "date-fns";
import { vi } from "date-fns/locale";
import MoneyLabel from "./MoneyLabel";
import {
  amountHighlight,
  amountHighlightLabelClass,
  amountHighlightTitle,
} from "@/lib/highValueThresholds";
import { dayProfit, dayProfitPct, mockRevenueForDay } from "@/lib/mockDayRevenue";

export type MonthMetric = "revenue" | "profit" | "percentage";

interface MonthOverviewGridProps {
  rangeStart: Date;
  rangeEnd: Date;
  totals: Map<string, number>;
  todayStr: string;
  high: number;
  veryHigh: number;
  metric: MonthMetric;
  onSelectDay: (dateStr: string) => void;
}

function formatPct(value: number) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

export default function MonthOverviewGrid({
  rangeStart,
  rangeEnd,
  totals,
  todayStr,
  high,
  veryHigh,
  metric,
  onSelectDay,
}: MonthOverviewGridProps) {
  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd],
  );

  const rowCount = Math.max(1, Math.ceil(days.length / 4));
  const padCount = rowCount * 4 - days.length;

  return (
    <div
      className="period-month-grid"
      style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
      data-no-double-tap
    >
      {days.map(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const weekend = getDay(day) === 0 || getDay(day) === 6;
        const isFuture = dateStr > todayStr;
        const today = dateStr === todayStr;
        const expense = totals.get(dateStr) ?? 0;
        const revenue = mockRevenueForDay(dateStr, expense);
        const profit = dayProfit(revenue, expense);
        const pct = dayProfitPct(revenue, profit);
        const profitable = profit > 0;
        const highlight = amountHighlight(expense, high, veryHigh);
        const monthBreak = day.getDate() === 1 && !isSameDay(day, rangeStart);

        const metricNode =
          metric === "revenue" ? (
            <MoneyLabel
              amount={revenue}
              className="text-[16px] font-semibold leading-none"
              smallClassName="text-[0.72em]"
              suffixClassName="text-[0.58em]"
            />
          ) : metric === "profit" ? (
            <MoneyLabel
              amount={profit}
              className="text-[16px] font-semibold leading-none"
              smallClassName="text-[0.72em]"
              suffixClassName="text-[0.58em]"
            />
          ) : pct == null ? (
            <span className="text-[16px] font-semibold leading-none text-muted-foreground/35">—</span>
          ) : (
            <span className="text-[16px] font-semibold leading-none tabular-nums">{formatPct(pct)}</span>
          );

        const inner = (
          <>
            <span className={`period-month-day ${weekend ? "period-month-day-weekend" : ""}`}>
              {format(day, "d")}
              {monthBreak && (
                <span className="period-month-month">{format(day, "MMM", { locale: vi })}</span>
              )}
            </span>
            <span
              className={`period-month-metrics ${profitable ? "period-month-metric-profit" : ""}`}
            >
              {metricNode}
            </span>
            <span className="period-month-amount">
              {expense > 0 ? (
                <MoneyLabel
                  amount={expense}
                  className={`text-[14px] leading-none text-foreground ${amountHighlightLabelClass(highlight)}`}
                  smallClassName="text-[0.72em]"
                  suffixClassName="text-[0.58em]"
                />
              ) : (
                <span className="text-[14px] leading-none text-muted-foreground/35">—</span>
              )}
            </span>
          </>
        );

        if (isFuture) {
          return (
            <div
              key={dateStr}
              className={`period-month-cell period-month-cell-future ${weekend ? "period-month-cell-weekend" : ""}`}
              aria-label={`${format(day, "PPP", { locale: vi })} · chưa tới`}
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
            aria-label={`${format(day, "PPP", { locale: vi })} · ${expense > 0 ? `${expense} đồng` : "chưa chi"}`}
            title={amountHighlightTitle(highlight)}
            className={[
              "period-month-cell",
              weekend && "period-month-cell-weekend",
              today && "period-month-cell-today",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {inner}
          </button>
        );
      })}
      {Array.from({ length: padCount }, (_, i) => (
        <div key={`pad-${i}`} className="period-month-cell period-month-cell-pad" aria-hidden />
      ))}
    </div>
  );
}

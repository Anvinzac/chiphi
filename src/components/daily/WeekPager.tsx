import { useEffect, useRef, useState, type ReactNode } from "react";
import MoneyLabel from "./MoneyLabel";
import { formatDayMonth } from "@/lib/formatDateVi";

export interface WeekPage<T> {
  key: string;
  weekStart: Date;
  weekEnd: Date;
  total: number;
  sections: T[];
}

interface WeekPagerProps<T> {
  weeks: WeekPage<T>[];
  renderSection: (section: T) => ReactNode;
  footer?: ReactNode;
}

/** Each ISO week (Mon–Sun) becomes its own horizontally swipeable page. */
export default function WeekPager<T>({ weeks, renderSection, footer }: WeekPagerProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [weeks.length, weeks[0]?.key]);

  const settleActive = () => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.max(0, Math.min(weeks.length - 1, idx)));
  };

  const goTo = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
    setActive(idx);
  };

  if (weeks.length === 0) return null;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-no-double-tap
      onTouchStart={e => e.stopPropagation()}
    >
      {weeks.length > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-background/95 px-1 py-2">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Tuần trong kỳ">
            {weeks.map((week, i) => (
              <button
                key={week.key}
                type="button"
                role="tab"
                onClick={() => goTo(i)}
                aria-label={`Tuần ${formatDayMonth(week.weekStart)} – ${formatDayMonth(week.weekEnd)}`}
                aria-selected={i === active}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === active
                    ? "w-5 bg-primary"
                    : "w-1.5 bg-border hover:bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            {active + 1}/{weeks.length}
          </span>
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={settleActive}
        onTouchEnd={settleActive}
        className="week-snap-pager week-snap-pager-fill -mx-4"
      >
        {weeks.map(week => (
          <div key={week.key} className="week-snap-page px-4">
            <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
              <h2 className="font-display text-sm tracking-wide text-muted-foreground">
                Tuần {formatDayMonth(week.weekStart)} – {formatDayMonth(week.weekEnd)}
              </h2>
              <MoneyLabel
                amount={week.total}
                className="text-xs text-muted-foreground"
                smallClassName="text-[0.7em]"
              />
            </div>
            {week.sections.map(renderSection)}
            {footer}
          </div>
        ))}
      </div>
    </div>
  );
}

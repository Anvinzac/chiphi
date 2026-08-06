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
}

/** Each ISO week (Mon–Sun) becomes its own horizontally swipeable page. */
export default function WeekPager<T>({ weeks, renderSection }: WeekPagerProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [weeks.length, weeks[0]?.key]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.max(0, Math.min(weeks.length - 1, idx)));
  };

  const goTo = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
  };

  if (weeks.length === 0) return null;

  return (
    <div data-no-double-tap>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className="-mx-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain no-scrollbar"
      >
        {weeks.map(week => (
          <div key={week.key} className="w-full shrink-0 snap-center px-4">
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
          </div>
        ))}
      </div>

      {weeks.length > 1 && (
        <div className="mt-1 flex items-center justify-center gap-1.5 py-2">
          {weeks.map((week, i) => (
            <button
              key={week.key}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Tuần ${formatDayMonth(week.weekStart)}`}
              aria-current={i === active}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-5 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

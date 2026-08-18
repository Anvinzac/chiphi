import { useEffect, useRef, useState, type ReactNode } from "react";
import MoneyLabel from "./MoneyLabel";
import { formatDayMonth } from "@/lib/formatDateVi";
import { useSnapPagerAxisLock } from "@/hooks/useSnapPagerAxisLock";
import { SEARCH_BAR_HEIGHT, SEARCH_PULL_OPEN_PX } from "./ListSearchBar";

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
  searchPullEnabled?: boolean;
  onSearchPull?: (px: number) => void;
  onSearchPullEnd?: (open: boolean) => void;
}

/**
 * Each ISO week (Mon–Sun) becomes its own horizontally swipeable page.
 * Pull down on the week dots to reveal list search in the parent.
 */
export default function WeekPager<T>({
  weeks,
  renderSection,
  footer,
  searchPullEnabled = false,
  onSearchPull,
  onSearchPullEnd,
}: WeekPagerProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useSnapPagerAxisLock(scrollerRef);

  const pullStartX = useRef(0);
  const pullStartY = useRef(0);
  const pullLocked = useRef<"pull" | "skip" | null>(null);
  const pullPx = useRef(0);
  const didPull = useRef(false);

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

  const endPull = () => {
    if (!searchPullEnabled) return;
    if (pullLocked.current === "pull") {
      didPull.current = pullPx.current > 8;
      onSearchPullEnd?.(pullPx.current >= SEARCH_PULL_OPEN_PX);
    }
    pullLocked.current = null;
    pullPx.current = 0;
  };

  const onPullStart = (e: React.TouchEvent) => {
    if (!searchPullEnabled) return;
    pullStartX.current = e.touches[0].clientX;
    pullStartY.current = e.touches[0].clientY;
    pullLocked.current = null;
    pullPx.current = 0;
  };

  const onPullMove = (e: React.TouchEvent) => {
    if (!searchPullEnabled || pullLocked.current === "skip") return;
    const dx = e.touches[0].clientX - pullStartX.current;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (!pullLocked.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      const downward = dy > 8 && dy > Math.abs(dx) * 1.35;
      pullLocked.current = downward ? "pull" : "skip";
      if (!downward) return;
    }
    if (pullLocked.current !== "pull") return;
    const next = Math.min(SEARCH_BAR_HEIGHT + 10, Math.max(0, dy * 0.62));
    pullPx.current = next;
    onSearchPull?.(next);
  };

  if (weeks.length === 0) return null;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-no-double-tap
      onTouchStart={e => e.stopPropagation()}
    >
      <div
        className="flex shrink-0 items-center justify-center gap-2 bg-background/95 px-1 py-2"
        onTouchStart={onPullStart}
        onTouchMove={onPullMove}
        onTouchEnd={endPull}
        onTouchCancel={endPull}
      >
        {weeks.length > 1 ? (
          <>
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Tuần trong kỳ">
              {weeks.map((week, i) => (
                <button
                  key={week.key}
                  type="button"
                  role="tab"
                  onClick={() => {
                    if (didPull.current) {
                      didPull.current = false;
                      return;
                    }
                    goTo(i);
                  }}
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
          </>
        ) : (
          <div className="h-1.5 w-8 rounded-full bg-border/70" aria-hidden="true" />
        )}
      </div>

      <div
        ref={scrollerRef}
        onScroll={settleActive}
        onTouchEnd={settleActive}
        className="week-snap-pager week-snap-pager-fill -mx-4"
      >
        {weeks.map(week => (
          <div key={week.key} className="week-snap-page px-4">
            <div className="week-snap-page-inner">
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
          </div>
        ))}
      </div>
    </div>
  );
}

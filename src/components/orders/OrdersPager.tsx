import { useEffect, useRef, useState, type ReactNode } from "react";

export interface OrdersPage<T> {
  key: string;
  title: string;
  count: number;
  sections: T[];
}

interface OrdersPagerProps<T> {
  pages: OrdersPage<T>[];
  renderSection: (section: T) => ReactNode;
  emptyLabel?: string;
}

/** Horizontally swipeable day or week pages for the order history. */
export default function OrdersPager<T>({
  pages,
  renderSection,
  emptyLabel = "Chưa có đơn",
}: OrdersPagerProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [pages.length, pages[0]?.key]);

  const settleActive = () => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.max(0, Math.min(pages.length - 1, idx)));
  };

  const goTo = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
    setActive(idx);
  };

  if (pages.length === 0) return null;

  return (
    <div data-no-double-tap>
      {pages.length > 1 && (
        <div className="sticky top-0 z-20 -mx-1 mb-1 flex items-center justify-center gap-2 bg-background/95 px-1 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Trang đơn hàng">
            {pages.map((page, i) => (
              <button
                key={page.key}
                type="button"
                role="tab"
                onClick={() => goTo(i)}
                aria-label={page.title}
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
            {active + 1}/{pages.length}
          </span>
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={settleActive}
        onTouchEnd={settleActive}
        className="-mx-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain no-scrollbar"
      >
        {pages.map(page => (
          <div key={page.key} className="w-full shrink-0 snap-center px-4">
            <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
              <h2 className="min-w-0 truncate font-display text-sm tracking-wide text-muted-foreground">
                {page.title}
              </h2>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {page.count} đơn
              </span>
            </div>
            {page.sections.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
                {emptyLabel}
              </p>
            ) : (
              page.sections.map(renderSection)
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

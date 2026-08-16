import { useRef, useState, useCallback, useEffect } from "react";
import MoneyLabel from "./MoneyLabel";
import CategoryGlyph from "./CategoryGlyph";

interface SwipeableEntryRowProps {
  item_name: string;
  amount: number;
  notes?: string | null;
  categoryName?: string;
  supplierName?: string;
  isHighValue?: boolean;
  isPending?: boolean;
  onDelete: () => void;
  onClick: () => void;
  onNameClick?: () => void;
  onSkip?: () => void;
}

const ACTION_WIDTH = 88;
const OPEN_THRESHOLD = 40;
const PAGER_MOVE_PX = 12;

function findHorizontalScroller(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body) {
    const { overflowX } = getComputedStyle(node);
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth + 8
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export default function SwipeableEntryRow({
  item_name,
  amount,
  notes,
  categoryName,
  supplierName,
  isHighValue,
  isPending = false,
  onDelete,
  onClick,
  onNameClick,
  onSkip,
}: SwipeableEntryRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const locked = useRef<"h" | "v" | null>(null);
  const offsetRef = useRef(0);
  const pagerRef = useRef<HTMLElement | null>(null);
  const pagerStartLeft = useRef(0);
  const cancelledByPager = useRef(false);

  useEffect(() => {
    offsetRef.current = offsetX;
  }, [offsetX]);

  const close = useCallback(() => setOffsetX(0), []);

  const pagerMoved = useCallback(() => {
    const scroller = pagerRef.current;
    if (!scroller) return false;
    return Math.abs(scroller.scrollLeft - pagerStartLeft.current) > PAGER_MOVE_PX;
  }, []);

  const cancelForPager = useCallback(() => {
    cancelledByPager.current = true;
    locked.current = "v";
    setOffsetX(0);
    setSwiping(false);
  }, []);

  useEffect(() => {
    const onPagerSlide = () => {
      if (offsetRef.current !== 0 || swiping) cancelForPager();
    };
    window.addEventListener("mise:page-slide", onPagerSlide);
    return () => window.removeEventListener("mise:page-slide", onPagerSlide);
  }, [cancelForPager, swiping]);

  useEffect(() => {
    if (!swiping) return;
    const scroller = pagerRef.current;
    if (!scroller) return;
    const onScroll = () => {
      if (pagerMoved()) cancelForPager();
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [swiping, pagerMoved, cancelForPager]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    startOffset.current = offsetRef.current;
    locked.current = null;
    cancelledByPager.current = false;
    const scroller = findHorizontalScroller(e.currentTarget as HTMLElement);
    pagerRef.current = scroller;
    pagerStartLeft.current = scroller?.scrollLeft ?? 0;
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping || cancelledByPager.current) return;
    if (pagerMoved()) {
      cancelForPager();
      return;
    }
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!locked.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      locked.current = Math.abs(dy) > Math.abs(dx) ? "v" : "h";
      if (locked.current === "v") {
        setSwiping(false);
        return;
      }
    }
    if (locked.current !== "h") return;

    const next = Math.min(0, Math.max(-ACTION_WIDTH, startOffset.current + dx));
    setOffsetX(next);
  }, [swiping, pagerMoved, cancelForPager]);

  const handleTouchEnd = useCallback(() => {
    setSwiping(false);
    if (cancelledByPager.current || pagerMoved()) {
      cancelledByPager.current = false;
      locked.current = null;
      setOffsetX(0);
      return;
    }
    if (locked.current !== "h") {
      locked.current = null;
      return;
    }
    locked.current = null;
    setOffsetX(offsetRef.current < -OPEN_THRESHOLD ? -ACTION_WIDTH : 0);
  }, [pagerMoved]);

  const handleRowClick = () => {
    if (offsetRef.current !== 0) {
      close();
      return;
    }
    onClick();
  };

  const titleClass = "text-sm font-medium truncate text-foreground/90 text-left min-w-0";

  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width: ACTION_WIDTH }}
        aria-hidden={offsetX === 0}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            close();
          }}
          className="h-full w-full bg-destructive text-destructive-foreground text-sm font-semibold tracking-wide active:brightness-90"
          aria-label="Xóa"
        >
          Xóa
        </button>
      </div>

      <div
        className="relative bg-background transition-transform will-change-transform"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? "none" : "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleRowClick}
      >
        <div className={`flex items-start justify-between gap-3 px-3 py-3 cursor-pointer active:bg-muted/20 transition-colors border-b border-border/35 ${
          isPending ? "reminder-row" : ""
        }`}>
          <CategoryGlyph categoryName={categoryName} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              {onNameClick ? (
                <button
                  type="button"
                  className={`${titleClass} hover:text-primary transition-colors`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (offsetRef.current !== 0) {
                      close();
                      return;
                    }
                    onNameClick();
                  }}
                >
                  {item_name}
                </button>
              ) : (
                <span className={titleClass}>{item_name}</span>
              )}
              {supplierName && !isPending && (
                <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-accent/25 text-accent-foreground">
                  {supplierName}
                </span>
              )}
              {isPending && (
                <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-background/70 text-primary font-medium">
                  Nhắc lịch
                </span>
              )}
            </div>
            {notes && (
              <p className="mt-0.5 text-[11px] text-muted-foreground/75 truncate italic leading-snug">
                {notes}
              </p>
            )}
            {categoryName && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/70 text-muted-foreground">
                  {categoryName}
                </span>
              </div>
            )}
          </div>
          <span
            className={`shrink-0 pt-0.5 pl-1 ${
              !isPending && isHighValue ? "border-b-2 border-destructive/70" : ""
            }`}
            title={!isPending && isHighValue ? "Giá trị cao" : undefined}
          >
            {isPending ? (
              <span className="flex items-center gap-1.5">
                {onSkip && (
                  <button
                    type="button"
                    className="text-[10px] px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (offsetRef.current !== 0) {
                        close();
                        return;
                      }
                      onSkip();
                    }}
                  >
                    Bỏ qua
                  </button>
                )}
                <button
                  type="button"
                  className="text-[10px] px-2 py-0.5 rounded-full border border-destructive/35 text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    close();
                    onDelete();
                  }}
                >
                  Xóa
                </button>
              </span>
            ) : (
              <MoneyLabel
                amount={amount}
                className="text-sm font-display text-foreground/85"
                smallClassName="text-[0.7em]"
              />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

import { useEffect, type RefObject } from "react";
import { SEARCH_BAR_HEIGHT, SEARCH_PULL_OPEN_PX } from "@/components/daily/ListSearchBar";

const MOVE_PX = 12;
const SEARCH_PX = 8;
const HORIZONTAL_PX = 18;
const HORIZONTAL_RATIO = 1.15;
const PAGE_FLIP_PX = 48;

export type SearchPullOptions = {
  enabled: boolean;
  slotRef?: RefObject<HTMLElement | null>;
  onPull?: (px: number) => void;
  onPullEnd?: (open: boolean) => void;
};

/**
 * Vertical list scrolling vs horizontal page snaps share one touch stream.
 * At the top of a week (or on the dots), a downward pull reveals search.
 *
 * Vertical pans must stay native: preventDefault, overflow changes, or
 * scrollLeft reads during a Y gesture make iOS scroll hitch in steps.
 */
export function useSnapPagerAxisLock(
  scrollerRef: RefObject<HTMLElement | null>,
  rootRef?: RefObject<HTMLElement | null>,
  searchPullRef?: RefObject<SearchPullOptions>,
  pageCount = 0,
) {
  useEffect(() => {
    const scroller = scrollerRef.current;
    const root = rootRef?.current ?? scroller;
    if (!scroller || !root || pageCount === 0) return;

    let axis: "x" | "y" | "search" | null = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let fromDots = false;
    let page: HTMLElement | null = null;
    let pullPx = 0;
    let pullNotified = false;

    const pages = () => scroller.querySelectorAll<HTMLElement>(".week-snap-page");

    const activePage = () => {
      const width = scroller.clientWidth || 1;
      const idx = Math.round(scroller.scrollLeft / width);
      return pages()[idx] ?? null;
    };

    const applyPull = (px: number) => {
      pullPx = px;
      const slot = searchPullRef?.current.slotRef?.current;
      if (slot) {
        slot.style.transition = "none";
        slot.style.height = `${px}px`;
      }
      if (!pullNotified) {
        pullNotified = true;
        searchPullRef?.current.onPull?.(px);
      }
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const target = e.target as Element | null;
      fromDots = !!target?.closest("[data-week-dots]");
      page = (target?.closest(".week-snap-page") as HTMLElement | null) ?? (fromDots ? activePage() : null);
      startX = t.clientX;
      startY = t.clientY;
      startLeft = scroller.scrollLeft;
      startTop = page?.scrollTop ?? 0;
      axis = null;
      pullPx = 0;
      pullNotified = false;

      const active = document.activeElement;
      if (
        page &&
        target &&
        page.contains(target) &&
        active instanceof HTMLElement &&
        active.closest("[data-search-pull-slot]")
      ) {
        active.blur();
      }
    };

    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const pull = searchPullRef?.current;
      const atTop = fromDots || (startTop <= 1 && (page?.scrollTop ?? 0) <= 1);

      if (!axis) {
        if (adx < SEARCH_PX && ady < SEARCH_PX) return;
        if (
          pull?.enabled &&
          atTop &&
          dy >= SEARCH_PX &&
          ady > adx * HORIZONTAL_RATIO
        ) {
          axis = "search";
          if (page) page.scrollTop = startTop;
        } else if (adx >= HORIZONTAL_PX && adx > ady * HORIZONTAL_RATIO) {
          axis = "x";
        } else if (ady >= MOVE_PX && ady >= adx) {
          axis = "y";
        } else {
          return;
        }
      }

      if (axis === "y") return;

      e.preventDefault();

      if (axis === "search") {
        if (page) page.scrollTop = startTop;
        applyPull(Math.min(SEARCH_BAR_HEIGHT + 16, Math.max(0, dy)));
        return;
      }

      scroller.scrollLeft = startLeft - dx;
    };

    const onEnd = () => {
      if (axis === "x") {
        const width = scroller.clientWidth || 1;
        const dx = scroller.scrollLeft - startLeft;
        const startIdx = Math.round(startLeft / width);
        let idx = startIdx;
        if (dx > PAGE_FLIP_PX) idx = startIdx + 1;
        else if (dx < -PAGE_FLIP_PX) idx = startIdx - 1;
        else idx = Math.round(scroller.scrollLeft / width);
        const max = Math.max(0, pages().length - 1);
        idx = Math.max(0, Math.min(max, idx));
        scroller.scrollTo({ left: idx * width, behavior: "smooth" });
        window.dispatchEvent(new Event("mise:page-slide"));
      } else if (axis === "y") {
        scroller.scrollLeft = startLeft;
      } else if (axis === "search") {
        searchPullRef?.current.onPullEnd?.(pullPx >= SEARCH_PULL_OPEN_PX);
      }
      axis = null;
      pullPx = 0;
      pullNotified = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      const width = scroller.clientWidth || 1;
      const pinned = Math.round(scroller.scrollLeft / width) * width;
      if (scroller.scrollLeft !== pinned) scroller.scrollLeft = pinned;
    };

    root.addEventListener("touchstart", onStart, { passive: true, capture: true });
    root.addEventListener("touchmove", onMove, { passive: false, capture: true });
    root.addEventListener("touchend", onEnd, { capture: true });
    root.addEventListener("touchcancel", onEnd, { capture: true });
    scroller.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      root.removeEventListener("touchstart", onStart, { capture: true });
      root.removeEventListener("touchmove", onMove, { capture: true });
      root.removeEventListener("touchend", onEnd, { capture: true });
      root.removeEventListener("touchcancel", onEnd, { capture: true });
      scroller.removeEventListener("wheel", onWheel);
    };
  }, [scrollerRef, rootRef, searchPullRef, pageCount]);
}

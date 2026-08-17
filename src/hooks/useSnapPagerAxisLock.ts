import { useEffect, type RefObject } from "react";

const MOVE_PX = 12;
const HORIZONTAL_PX = 28;
const HORIZONTAL_ON_ROW_PX = 96;
const HORIZONTAL_RATIO = 2.2;
const PAGE_FLIP_PX = 56;

/**
 * Vertical list scrolling vs horizontal page snaps share one touch stream.
 * Lock to one axis: vertical unless the swipe is clearly sideways.
 */
export function useSnapPagerAxisLock(scrollerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let axis: "x" | "y" | null = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let fromEntry = false;

    const pages = () => el.querySelectorAll<HTMLElement>(".week-snap-page");

    const restorePages = () => {
      pages().forEach(page => {
        page.style.overflowY = "";
      });
      el.style.overflowX = "";
    };

    const lockY = () => {
      el.style.overflowX = "hidden";
      el.scrollLeft = startLeft;
    };

    const lockX = () => {
      pages().forEach(page => {
        page.style.overflowY = "hidden";
      });
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      startLeft = el.scrollLeft;
      axis = null;
      fromEntry = Boolean((e.target as Element | null)?.closest("[data-swipeable-entry]"));
      restorePages();
    };

    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!axis) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < MOVE_PX && ady < MOVE_PX) return;
        const needX = fromEntry ? HORIZONTAL_ON_ROW_PX : HORIZONTAL_PX;
        if (ady >= MOVE_PX && ady >= adx) {
          axis = "y";
          lockY();
        } else if (adx >= needX && adx > ady * HORIZONTAL_RATIO) {
          axis = "x";
          lockX();
        } else {
          if (el.scrollLeft !== startLeft) el.scrollLeft = startLeft;
          return;
        }
      }

      if (axis === "y") {
        if (el.scrollLeft !== startLeft) el.scrollLeft = startLeft;
        return;
      }

      e.preventDefault();
      el.scrollLeft = startLeft - dx;
    };

    const onEnd = () => {
      if (axis === "x") {
        const width = el.clientWidth || 1;
        const dx = el.scrollLeft - startLeft;
        const startIdx = Math.round(startLeft / width);
        let idx = startIdx;
        if (dx > PAGE_FLIP_PX) idx = startIdx + 1;
        else if (dx < -PAGE_FLIP_PX) idx = startIdx - 1;
        else idx = Math.round(el.scrollLeft / width);
        const max = Math.max(0, pages().length - 1);
        idx = Math.max(0, Math.min(max, idx));
        el.scrollTo({ left: idx * width, behavior: "smooth" });
        window.dispatchEvent(new Event("mise:page-slide"));
      } else if (axis === "y") {
        el.scrollLeft = startLeft;
      }
      axis = null;
      fromEntry = false;
      restorePages();
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      const width = el.clientWidth || 1;
      const pinned = Math.round(el.scrollLeft / width) * width;
      if (el.scrollLeft !== pinned) el.scrollLeft = pinned;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false, capture: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove, { capture: true });
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
      restorePages();
    };
  }, [scrollerRef]);
}

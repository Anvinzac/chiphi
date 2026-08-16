import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Keeps a horizontal snap pager as tall as the settled page.
 * Height is applied after snap, never while the finger is moving — resizing
 * the scroller mid-swipe makes iOS skip the middle snap point.
 */
export function useSnapPagerHeight(pageCount: number, pagesKey: string) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const heightsRef = useRef<number[]>([]);
  const readyRef = useRef(false);

  const applyHeight = useCallback((animate = false) => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0 || pageCount === 0) return;

    const idx = Math.round(el.scrollLeft / el.clientWidth);
    const i = Math.min(Math.max(0, idx), pageCount - 1);
    const height = heightsRef.current[i];
    if (!height) return;

    el.style.transition = animate ? "height 180ms ease" : "none";
    el.style.height = `${height}px`;
  }, [pageCount]);

  const bindPageRef = useCallback((index: number, node: HTMLDivElement | null) => {
    pageRefs.current[index] = node;
  }, []);

  useLayoutEffect(() => {
    readyRef.current = false;
    pageRefs.current.length = pageCount;
    heightsRef.current = [];
    const observers: ResizeObserver[] = [];

    for (let i = 0; i < pageCount; i++) {
      const page = pageRefs.current[i];
      if (!page) continue;

      const measure = () => {
        heightsRef.current[i] = page.offsetHeight;
        applyHeight(readyRef.current);
        readyRef.current = true;
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(page);
      observers.push(ro);
    }

    return () => observers.forEach(ro => ro.disconnect());
  }, [pageCount, pagesKey, applyHeight]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onEnd = () => applyHeight(true);
    el.addEventListener("scrollend", onEnd);
    return () => el.removeEventListener("scrollend", onEnd);
  }, [applyHeight, pagesKey]);

  return { scrollerRef, bindPageRef, applyHeight };
}

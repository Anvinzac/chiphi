import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Keeps a horizontal snap pager as tall as the page in view.
 * Heights interpolate while swiping so shorter pages don't leave a gap
 * sized by the longest sibling.
 */
export function useSnapPagerHeight(pageCount: number, pagesKey: string) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const heightsRef = useRef<number[]>([]);
  const readyRef = useRef(false);

  const applyHeight = useCallback((animate = false) => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0 || pageCount === 0) return;

    const heights = heightsRef.current;
    const progress = el.scrollLeft / el.clientWidth;
    const last = pageCount - 1;
    const i = Math.min(Math.max(0, Math.floor(progress)), last);
    const t = Math.min(1, Math.max(0, progress - i));
    const from = heights[i];
    const to = heights[Math.min(i + 1, last)];
    if (!from) return;

    el.style.transition = animate ? "height 180ms ease" : "none";
    el.style.height = `${to ? from + (to - from) * t : from}px`;
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

  return { scrollerRef, bindPageRef, applyHeight };
}

/** Focus an element without letting the browser scroll it into view (iOS Safari). */
export function focusWithoutScroll(el: HTMLElement | null | undefined) {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

/**
 * Freeze document scroll while a bottom sheet / panel is open.
 * Prevents iOS Safari from scrolling the page when focusing inputs.
 */
export function lockBodyScroll() {
  const html = document.documentElement;
  const body = document.body;
  const scrollY = window.scrollY;

  const prev = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
  };

  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";

  const snapScroll = () => {
    window.scrollTo(0, 0);
    html.scrollTop = 0;
    body.scrollTop = 0;
    document.querySelectorAll<HTMLElement>("[data-expense-list]").forEach(el => {
      el.scrollTop = 0;
    });
  };

  const onFocusIn = () => {
    snapScroll();
    requestAnimationFrame(snapScroll);
    // iOS often scrolls asynchronously after keyboard opens
    window.setTimeout(snapScroll, 50);
    window.setTimeout(snapScroll, 150);
    window.setTimeout(snapScroll, 300);
  };

  document.addEventListener("focusin", onFocusIn, true);
  // Also catch visual viewport resizing (keyboard)
  const vv = window.visualViewport;
  vv?.addEventListener("resize", snapScroll);
  vv?.addEventListener("scroll", snapScroll);

  return () => {
    document.removeEventListener("focusin", onFocusIn, true);
    vv?.removeEventListener("resize", snapScroll);
    vv?.removeEventListener("scroll", snapScroll);
    html.style.overflow = prev.htmlOverflow;
    body.style.overflow = prev.bodyOverflow;
    body.style.position = prev.bodyPosition;
    body.style.top = prev.bodyTop;
    body.style.left = prev.bodyLeft;
    body.style.right = prev.bodyRight;
    body.style.width = prev.bodyWidth;
    window.scrollTo(0, scrollY);
  };
}

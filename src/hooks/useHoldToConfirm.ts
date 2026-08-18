import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const HOLD_MS = 480;
const MOVE_CANCEL_PX = 10;
const ARM_EVENT = "mise:entry-delete-arm";

type HoldToConfirmOptions = {
  enabled?: boolean;
  /** Skip starting a hold when the pointer lands in these elements. */
  ignoreSelector?: string;
};

/** Long-press a row to reveal a trailing confirm action instead of swipe-to-delete. */
export function useHoldToConfirm({ enabled = true, ignoreSelector }: HoldToConfirmOptions = {}) {
  const rowId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const suppressClick = useRef(false);
  const [confirming, setConfirming] = useState(false);

  const clearHold = useCallback(() => {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const arm = useCallback(() => {
    holdTimer.current = null;
    suppressClick.current = true;
    setConfirming(true);
    window.dispatchEvent(new CustomEvent(ARM_EVENT, { detail: rowId }));
  }, [rowId]);

  const cancelConfirm = useCallback(() => setConfirming(false), []);

  useEffect(() => () => clearHold(), [clearHold]);

  useEffect(() => {
    const onArm = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== rowId) setConfirming(false);
    };
    const onScroll = () => {
      clearHold();
      setConfirming(false);
    };
    window.addEventListener(ARM_EVENT, onArm);
    window.addEventListener("mise:page-slide", cancelConfirm);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener(ARM_EVENT, onArm);
      window.removeEventListener("mise:page-slide", cancelConfirm);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [rowId, cancelConfirm, clearHold]);

  useEffect(() => {
    if (!confirming) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setConfirming(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [confirming]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!enabled || confirming || e.button !== 0) return;
    if (ignoreSelector && (e.target as Element | null)?.closest(ignoreSelector)) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    clearHold();
    holdTimer.current = window.setTimeout(arm, HOLD_MS);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (holdTimer.current == null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) clearHold();
  };

  const onPointerUp = () => clearHold();
  const onPointerCancel = () => clearHold();

  const consumeClick = () => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  };

  return {
    confirming,
    cancelConfirm,
    consumeClick,
    rootRef,
    holdProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onContextMenu: (e: React.MouseEvent) => {
        if (enabled) e.preventDefault();
      },
    },
  };
}

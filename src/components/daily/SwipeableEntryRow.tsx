import { useCallback, useEffect, useId, useRef, useState } from "react";
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

const HOLD_MS = 480;
const MOVE_CANCEL_PX = 10;
const ARM_EVENT = "mise:entry-delete-arm";

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

  const armDelete = useCallback(() => {
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isPending || confirming || e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    clearHold();
    holdTimer.current = window.setTimeout(armDelete, HOLD_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (holdTimer.current == null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) clearHold();
  };

  const handlePointerEnd = () => clearHold();

  const consumeSuppressedClick = () => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  };

  const handleRowClick = () => {
    if (consumeSuppressedClick()) return;
    if (confirming) {
      cancelConfirm();
      return;
    }
    onClick();
  };

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (consumeSuppressedClick()) return;
    if (confirming) {
      cancelConfirm();
      return;
    }
    onNameClick?.();
  };

  const titleClass = "text-sm font-medium truncate text-foreground/90 text-left min-w-0";

  return (
    <div
      ref={rootRef}
      className="relative select-none [-webkit-touch-callout:none]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onContextMenu={e => {
        if (!isPending) e.preventDefault();
      }}
    >
      <div
        className={`flex items-start justify-between gap-3 px-3 py-3 cursor-pointer active:bg-muted/20 transition-colors border-b border-border/35 ${
          isPending ? "reminder-row" : ""
        } ${confirming ? "bg-destructive/5" : ""}`}
        onClick={handleRowClick}
      >
        <CategoryGlyph categoryName={categoryName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {onNameClick ? (
              <button type="button" className={`${titleClass} hover:text-primary transition-colors`} onClick={handleNameClick}>
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
            !isPending && !confirming && isHighValue ? "border-b-2 border-destructive/70" : ""
          }`}
          title={!isPending && isHighValue ? "Giá trị cao" : undefined}
        >
          {isPending ? (
            <span className="flex items-center gap-1.5">
              {onSkip && (
                <button
                  type="button"
                  className="text-[10px] px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  onClick={e => {
                    e.stopPropagation();
                    onSkip();
                  }}
                >
                  Bỏ qua
                </button>
              )}
              <button
                type="button"
                className="text-[10px] px-2 py-0.5 rounded-full border border-destructive/35 text-destructive hover:bg-destructive/10 transition-colors"
                onClick={e => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                Xóa
              </button>
            </span>
          ) : confirming ? (
            <button
              type="button"
              className="text-xs font-semibold px-3 py-1 rounded-full bg-destructive text-destructive-foreground active:brightness-90"
              aria-label="Xóa"
              onClick={e => {
                e.stopPropagation();
                onDelete();
                cancelConfirm();
              }}
            >
              Xóa
            </button>
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
  );
}

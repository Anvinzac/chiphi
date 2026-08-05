import { useRef, useState, useCallback, useEffect } from "react";

interface SwipeableEntryRowProps {
  item_name: string;
  amount: number;
  notes?: string | null;
  categoryName?: string;
  supplierName?: string;
  isHighValue?: boolean;
  onDelete: () => void;
  onClick: () => void;
  onNameClick?: () => void;
}

const ACTION_WIDTH = 88;
const OPEN_THRESHOLD = 40;

export default function SwipeableEntryRow({
  item_name,
  amount,
  notes,
  categoryName,
  supplierName,
  isHighValue,
  onDelete,
  onClick,
  onNameClick,
}: SwipeableEntryRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const locked = useRef<"h" | "v" | null>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    offsetRef.current = offsetX;
  }, [offsetX]);

  const close = useCallback(() => setOffsetX(0), []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    startOffset.current = offsetRef.current;
    locked.current = null;
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
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
  }, [swiping]);

  const handleTouchEnd = useCallback(() => {
    setSwiping(false);
    if (locked.current !== "h") {
      locked.current = null;
      return;
    }
    locked.current = null;
    // Snap open or closed like UITableView — don't delete until the action is tapped
    setOffsetX(offsetRef.current < -OPEN_THRESHOLD ? -ACTION_WIDTH : 0);
  }, []);

  const handleRowClick = () => {
    if (offsetRef.current !== 0) {
      close();
      return;
    }
    onClick();
  };

  return (
    <div className="relative overflow-hidden">
      {/* iOS-style trailing delete action — only visible as the row slides */}
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

      {/* Sliding content */}
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
        <div className="flex items-start justify-between gap-3 px-3 py-3 cursor-pointer active:bg-muted/20 transition-colors border-b border-border/35">
          <div className="flex-1 min-w-0">
            {onNameClick ? (
              <button
                type="button"
                className="text-sm font-medium block truncate text-foreground/90 text-left max-w-full hover:text-primary transition-colors"
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
              <span className="text-sm font-medium block truncate text-foreground/90">{item_name}</span>
            )}
            {notes && (
              <p className="mt-0.5 text-[11px] text-muted-foreground/75 truncate italic leading-snug">
                {notes}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {categoryName && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/70 text-muted-foreground">
                  {categoryName}
                </span>
              )}
              {supplierName && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/25 text-accent-foreground">
                  {supplierName}
                </span>
              )}
              {isHighValue && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/12 text-destructive font-medium">
                  Giá trị cao
                </span>
              )}
            </div>
          </div>
          <span className="text-sm font-display tabular-nums whitespace-nowrap pt-0.5 pl-1 text-foreground/85">
            {amount.toLocaleString("vi-VN")} ₫
          </span>
        </div>
      </div>
    </div>
  );
}

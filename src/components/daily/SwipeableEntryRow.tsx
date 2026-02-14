import { useRef, useState, useCallback } from "react";
import { Trash2 } from "lucide-react";

interface SwipeableEntryRowProps {
  item_name: string;
  amount: number;
  categoryName?: string;
  supplierName?: string;
  isHighValue?: boolean;
  onDelete: () => void;
  onClick: () => void;
}

export default function SwipeableEntryRow({
  item_name,
  amount,
  categoryName,
  supplierName,
  isHighValue,
  onDelete,
  onClick,
}: SwipeableEntryRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const locked = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    locked.current = false;
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Lock direction on first significant move
    if (!locked.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      locked.current = true;
      if (Math.abs(dy) > Math.abs(dx)) {
        setSwiping(false);
        return;
      }
    }

    if (dx < 0) {
      setOffsetX(Math.max(dx, -120));
    }
  }, [swiping]);

  const handleTouchEnd = useCallback(() => {
    setSwiping(false);
    if (offsetX < -THRESHOLD) {
      // Animate out and delete
      setOffsetX(-300);
      setTimeout(onDelete, 200);
    } else {
      setOffsetX(0);
    }
  }, [offsetX, onDelete]);

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Delete background */}
      <div className="absolute inset-0 flex items-center justify-end px-4 bg-destructive/15 rounded-lg">
        <Trash2 className="h-4 w-4 text-destructive" />
      </div>

      {/* Foreground row */}
      <div
        className="relative bg-card border-b border-border/40 transition-transform"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? "none" : "transform 0.2s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (offsetX === 0) onClick(); }}
      >
        <div className="flex items-start justify-between py-3 gap-3 cursor-pointer active:bg-muted/30 transition-colors">
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium block truncate">{item_name}</span>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {categoryName && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {categoryName}
                </span>
              )}
              {supplierName && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/30 text-accent-foreground">
                  {supplierName}
                </span>
              )}
              {isHighValue && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">
                  High value
                </span>
              )}
            </div>
          </div>
          <span className="text-sm font-display tabular-nums whitespace-nowrap pt-0.5">
            {amount.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

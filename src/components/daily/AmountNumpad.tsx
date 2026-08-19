import { useRef } from "react";

interface AmountNumpadProps {
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onBackspace: () => void;
  onClear: () => void;
}

const DIGIT_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
] as const;

/**
 * Phone-style 3-column pad for thousands amounts.
 * Hold backspace to clear the whole value.
 */
export default function AmountNumpad({
  onDigit,
  onDecimal,
  onBackspace,
  onClear,
}: AmountNumpadProps) {
  const holdRef = useRef<number | null>(null);
  const heldRef = useRef(false);

  const startHold = () => {
    heldRef.current = false;
    holdRef.current = window.setTimeout(() => {
      heldRef.current = true;
      onClear();
    }, 500);
  };

  const endHold = () => {
    if (holdRef.current) window.clearTimeout(holdRef.current);
    holdRef.current = null;
  };

  const handleBackspaceClick = () => {
    if (heldRef.current) {
      heldRef.current = false;
      return;
    }
    onBackspace();
  };

  return (
    <div className="flex shrink-0 flex-col gap-1.5" data-amount-numpad>
      {DIGIT_ROWS.map(row => (
        <div key={row.join("")} className="grid grid-cols-3 gap-1.5">
          {row.map(digit => (
            <button
              key={digit}
              type="button"
              onClick={() => onDigit(digit)}
              className="keypad-key rounded-2xl border border-border/60 bg-card text-xl font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Nhập ${digit}`}
            >
              {digit}
            </button>
          ))}
        </div>
      ))}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={onDecimal}
          className="keypad-key rounded-2xl border border-border/60 bg-background text-xl font-medium text-muted-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Nhập dấu chấm"
        >
          .
        </button>
        <button
          type="button"
          onClick={() => onDigit("0")}
          className="keypad-key rounded-2xl border border-border/60 bg-card text-xl font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Nhập 0"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleBackspaceClick}
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          onContextMenu={e => e.preventDefault()}
          className="keypad-key rounded-2xl border border-border/60 bg-background text-xl font-medium text-muted-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Xóa số cuối (giữ để xóa hết)"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}

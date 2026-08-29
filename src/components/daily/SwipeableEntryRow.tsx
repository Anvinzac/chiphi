import { useState } from "react";
import { ChevronDown } from "lucide-react";
import MoneyLabel from "./MoneyLabel";
import CategoryGlyph from "./CategoryGlyph";
import SalaryRoster from "./SalaryRoster";
import { useHoldToConfirm } from "@/hooks/useHoldToConfirm";
import { isSalaryExpense } from "@/lib/salaryRoster";
import { useSalaryEmployees } from "@/hooks/useSalaryEmployees";
import { employeesToExpenseLines, type ExpenseLine } from "@/lib/salaryEmployees";
import {
  amountHighlightLabelClass,
  amountHighlightTitle,
  amountHighlightWrapClass,
  type AmountHighlight,
} from "@/lib/highValueThresholds";

interface SwipeableEntryRowProps {
  item_name: string;
  amount: number;
  notes?: string | null;
  categoryName?: string;
  supplierName?: string;
  highlight?: AmountHighlight;
  isPending?: boolean;
  nestedLines?: ExpenseLine[];
  onDelete: () => void;
  onClick: () => void;
  onNameClick?: () => void;
  onAmountClick?: () => void;
  onSkip?: () => void;
}

export default function SwipeableEntryRow({
  item_name,
  amount,
  notes,
  categoryName,
  supplierName,
  highlight = "none",
  isPending = false,
  nestedLines,
  onDelete,
  onClick,
  onNameClick,
  onAmountClick,
  onSkip,
}: SwipeableEntryRowProps) {
  const { confirming, cancelConfirm, consumeClick, rootRef, holdProps } = useHoldToConfirm({
    enabled: !isPending,
  });
  const salary = !isPending && isSalaryExpense(item_name, categoryName);
  const isContainer = !isPending;
  const [rosterOpen, setRosterOpen] = useState(false);
  const { employees, meta } = useSalaryEmployees();
  const ownLines = nestedLines ?? [];
  const displayLines =
    ownLines.length > 0 ? ownLines : salary ? employeesToExpenseLines(employees) : [];
  const periodLabel = ownLines.length > 0 ? null : meta?.period?.label;

  const handleRowClick = () => {
    if (consumeClick()) return;
    if (confirming) {
      cancelConfirm();
      return;
    }
    onClick();
  };

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (consumeClick()) return;
    if (confirming) {
      cancelConfirm();
      return;
    }
    onNameClick?.();
  };

  const handleAmountClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (consumeClick()) return;
    if (confirming) {
      cancelConfirm();
      return;
    }
    if (isContainer) {
      setRosterOpen(open => !open);
      return;
    }
    onAmountClick?.();
  };

  const titleClass = "text-sm font-medium truncate text-foreground/90 text-left min-w-0";

  return (
    <div
      ref={rootRef}
      className="relative select-none [-webkit-touch-callout:none]"
      {...holdProps}
    >
      <div
        className={`flex items-start justify-between gap-3 px-3 py-3 cursor-pointer active:bg-muted/20 transition-colors border-b border-border/35 ${
          isPending ? "reminder-row" : ""
        } ${confirming ? "bg-destructive/5" : ""}`}
        onClick={handleRowClick}
      >
        <CategoryGlyph categoryName={categoryName || (salary ? item_name : undefined)} />
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
            !isPending && !confirming ? amountHighlightWrapClass(highlight) : ""
          }`}
          title={!isPending && !confirming ? amountHighlightTitle(highlight) : undefined}
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
          ) : onAmountClick || isContainer ? (
            <button
              type="button"
              className="tabular-nums salary-amount-hit"
              title={
                rosterOpen
                  ? "Đóng chi tiết"
                  : salary
                    ? "Xem chi tiết lương"
                    : "Xem chi tiết khoản chi"
              }
              aria-expanded={rosterOpen}
              onClick={handleAmountClick}
            >
              <MoneyLabel
                amount={amount}
                className={`text-sm font-display text-foreground/85 ${amountHighlightLabelClass(highlight)}`}
                smallClassName="text-[0.7em]"
              />
              <ChevronDown className="salary-amount-chevron" strokeWidth={2.4} />
            </button>
          ) : (
            <MoneyLabel
              amount={amount}
              className={`text-sm font-display text-foreground/85 ${amountHighlightLabelClass(highlight)}`}
              smallClassName="text-[0.7em]"
            />
          )}
        </span>
      </div>
      {isContainer ? (
        <div className={`day-section-fold ${rosterOpen ? "day-section-fold--open" : ""}`}>
          <div className="day-section-fold__clip">
            <div className="day-section-fold__body">
              <SalaryRoster
                lines={displayLines}
                periodLabel={periodLabel}
                salary={salary}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

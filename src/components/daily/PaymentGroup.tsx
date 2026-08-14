import { useState } from "react";
import { parseISO } from "date-fns";
import { ChevronRight, ChevronDown } from "lucide-react";
import SwipeableEntryRow from "./SwipeableEntryRow";
import MoneyLabel from "./MoneyLabel";
import { formatDayMonth } from "@/lib/formatDateVi";
import type { ScheduleRepeat } from "@/lib/expenseSchedule";

export interface PaymentEntry {
  item_name: string;
  amount: number;
  category_id: string | null;
  supplier_id: string | null;
  sub_payment_id?: string;
  notes?: string | null;
  isPending?: boolean;
  scheduleId?: string;
  pendingRepeat?: Exclude<ScheduleRepeat, "none">;
  paymentMethod?: string | null;
}

export interface PaymentGroupData {
  paymentId: string;
  supplierName: string | null;
  total: number;
  entries: PaymentEntry[];
  date?: string;
}

interface PaymentGroupProps {
  group: PaymentGroupData;
  getCategoryName: (id: string | null) => string | undefined;
  getSupplierName: (id: string | null) => string | undefined;
  highValueThreshold: number;
  onEntryClick: (entry: PaymentEntry) => void;
  onEntryNameClick?: (entry: PaymentEntry) => void;
  onEntryDelete: (paymentId: string, entry: PaymentEntry, index: number) => void;
  onEntrySkip?: (paymentId: string, entry: PaymentEntry) => void;
}

export default function PaymentGroup({
  group,
  getCategoryName,
  getSupplierName,
  highValueThreshold,
  onEntryClick,
  onEntryNameClick,
  onEntryDelete,
  onEntrySkip,
}: PaymentGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const hasSupplier = Boolean(group.supplierName?.trim());

  const rows = group.entries.map((entry, i) => (
    <SwipeableEntryRow
      key={entry.sub_payment_id || i}
      item_name={entry.item_name}
      amount={entry.amount}
      notes={entry.notes}
      categoryName={getCategoryName(entry.category_id)}
      supplierName={getSupplierName(entry.supplier_id)}
      isHighValue={!entry.isPending && entry.amount >= highValueThreshold}
      isPending={entry.isPending}
      onClick={() => onEntryClick(entry)}
      onNameClick={onEntryNameClick ? () => onEntryNameClick(entry) : undefined}
      onDelete={() => onEntryDelete(group.paymentId, entry, i)}
      onSkip={
        entry.isPending && entry.scheduleId && onEntrySkip
          ? () => onEntrySkip(group.paymentId, entry)
          : undefined
      }
    />
  ));

  // No supplier → flat list (default). Don't invent an "Uncategorized" group.
  if (!hasSupplier) {
    return <div className="mb-1">{rows}</div>;
  }

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center gap-2 py-2.5 px-1 rounded-lg hover:bg-muted/40 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate">{group.supplierName}</span>
            {group.date && (
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {formatDayMonth(parseISO(group.date))}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted tabular-nums">
              {group.entries.length} mặt hàng
            </span>
          </div>
          <MoneyLabel
            amount={group.total}
            className="text-sm font-display"
            smallClassName="text-[0.7em]"
          />
        </div>
      </button>

      {expanded && (
        <div className="ml-5 pl-3 border-l border-border/50 animate-in fade-in slide-in-from-top-1 duration-150">
          {rows}
        </div>
      )}
    </div>
  );
}

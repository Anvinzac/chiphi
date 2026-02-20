import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import SwipeableEntryRow from "./SwipeableEntryRow";

export interface PaymentEntry {
  item_name: string;
  amount: number;
  category_id: string | null;
  supplier_id: string | null;
  sub_payment_id?: string;
}

export interface PaymentGroupData {
  paymentId: string;
  supplierName: string | null;
  total: number;
  entries: PaymentEntry[];
}

interface PaymentGroupProps {
  group: PaymentGroupData;
  getCategoryName: (id: string | null) => string | undefined;
  getSupplierName: (id: string | null) => string | undefined;
  highValueThreshold: number;
  onEntryClick: (entry: PaymentEntry) => void;
  onEntryDelete: (paymentId: string, entry: PaymentEntry, index: number) => void;
}

export default function PaymentGroup({ group, getCategoryName, getSupplierName, highValueThreshold, onEntryClick, onEntryDelete }: PaymentGroupProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-2">
      {/* Container header */}
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
            <span className="text-sm font-medium truncate">
              {group.supplierName || "Chưa phân loại"}
            </span>
            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted tabular-nums">
              {group.entries.length} {group.entries.length === 1 ? "mặt hàng" : "mặt hàng"}
            </span>
          </div>
          <span className="text-sm font-display tabular-nums whitespace-nowrap">
            {group.total.toLocaleString("vi-VN")} ₫
          </span>
        </div>
      </button>

      {/* Indented entries */}
      {expanded && (
        <div className="ml-5 pl-3 border-l border-border/50 animate-in fade-in slide-in-from-top-1 duration-150">
          {group.entries.map((entry, i) => (
            <SwipeableEntryRow
              key={entry.sub_payment_id || i}
              item_name={entry.item_name}
              amount={entry.amount}
              categoryName={getCategoryName(entry.category_id)}
              supplierName={getSupplierName(entry.supplier_id)}
              isHighValue={entry.amount >= highValueThreshold}
              onClick={() => onEntryClick(entry)}
              onDelete={() => onEntryDelete(group.paymentId, entry, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

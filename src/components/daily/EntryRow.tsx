interface EntryRowProps {
  item_name: string;
  amount: number;
  categoryName?: string;
  supplierName?: string;
  isHighValue?: boolean;
}

export default function EntryRow({ item_name, amount, categoryName, supplierName, isHighValue }: EntryRowProps) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-border/40 gap-3">
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
  );
}

import MoneyLabel from "./MoneyLabel";
import CategoryGlyph from "./CategoryGlyph";

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
      <CategoryGlyph categoryName={categoryName} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium truncate min-w-0">{item_name}</span>
          {supplierName && (
            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-accent/30 text-accent-foreground">
              {supplierName}
            </span>
          )}
        </div>
        {categoryName && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {categoryName}
            </span>
          </div>
        )}
      </div>
      <span
        className={`shrink-0 pt-0.5 ${isHighValue ? "border-b-2 border-destructive/70" : ""}`}
        title={isHighValue ? "Giá trị cao" : undefined}
      >
        <MoneyLabel
          amount={amount}
          className="text-sm font-display"
          smallClassName="text-[0.7em]"
        />
      </span>
    </div>
  );
}

import { useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { VerifyData } from "@/types/expense";

interface MatchInfo {
  itemId: string;
  categoryName: string;
  subCategoryName: string;
  supplierName: string;
  unitPrice: number;
  unit: string;
  categoryId: string | null;
  subCategoryId: string | null;
  subSubCategoryId: string | null;
  supplierId: string | null;
}

interface AmountPhaseProps {
  nameValue: string;
  amountValue: string;
  setAmountValue: (v: string) => void;
  amountRef: React.RefObject<HTMLInputElement>;
  match: MatchInfo | null;
  verifyData: VerifyData | null;
  setMatch: React.Dispatch<React.SetStateAction<MatchInfo | null>>;
  setVerifyData: React.Dispatch<React.SetStateAction<VerifyData | null>>;
  onBack: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSave: () => void;
}

type EditableField = "supplierName" | "categoryName" | "subCategoryName" | "unitPrice" | null;

export default function AmountPhase({
  nameValue,
  amountValue,
  setAmountValue,
  amountRef,
  match,
  verifyData,
  setMatch,
  setVerifyData,
  onBack,
  onKeyDown,
  onSave,
}: AmountPhaseProps) {
  const [editingField, setEditingField] = useState<EditableField>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const openEdit = (field: EditableField) => {
    if (!field) return;
    const current = match
      ? String(match[field as keyof MatchInfo] ?? "")
      : String(verifyData?.[field as keyof VerifyData] ?? "");
    setEditValue(current);
    setEditingField(field);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const commitEdit = () => {
    if (!editingField) return;
    const val = editValue.trim();
    setMatch(prev => {
      if (!prev) return prev;
      if (editingField === "unitPrice") return { ...prev, unitPrice: Number(val) || 0 };
      return { ...prev, [editingField]: val };
    });
    setVerifyData(prev => {
      if (!prev) return prev;
      if (editingField === "unitPrice") return { ...prev, unitPrice: Number(val) || 0 };
      return { ...prev, [editingField]: val };
    });
    setEditingField(null);
  };

  const cancelEdit = () => setEditingField(null);

  // Build pill rows from match or verifyData
  const supplier = match?.supplierName || verifyData?.supplierName || "";
  const category = match?.categoryName || verifyData?.categoryName || "";
  const subCategory = match?.subCategoryName || verifyData?.subCategoryName || "";
  const unitPrice = match?.unitPrice ?? verifyData?.unitPrice ?? 0;
  const unit = match?.unit || verifyData?.unit || "unit";

  const hasMeta = supplier || category || subCategory || unitPrice > 0;

  const allFields: { key: EditableField; label: string; value: string }[] = [
    { key: "supplierName", label: "Supplier", value: supplier },
    { key: "categoryName", label: "Category", value: category },
    { key: "subCategoryName", label: "Sub-cat", value: subCategory },
    { key: "unitPrice", label: `/${unit}`, value: unitPrice > 0 ? unitPrice.toLocaleString() : "" },
  ];
  const fields = allFields.filter(f => f.value !== "");

  return (
    <div className="flex-1 flex flex-col px-5 pt-2 pb-4 overflow-hidden">
      {/* Back link + item name */}
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors self-start mb-3"
        aria-label="Back to name"
      >
        ← {nameValue}
      </button>

      {/* Amount input */}
      <label className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
        Amount
      </label>
      <input
        ref={amountRef}
        type="number"
        inputMode="numeric"
        value={amountValue}
        onChange={(e) => setAmountValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="0"
        className="bg-transparent text-5xl font-display text-foreground placeholder:text-muted-foreground/20 outline-none w-full caret-primary tabular-nums mb-3"
        aria-label="Amount"
      />

      {/* Inline editable meta pills */}
      {hasMeta && (
        <div className="flex flex-wrap gap-2 mb-3">
          {fields.map(({ key, label, value }) =>
            editingField === key ? (
              <div
                key={key}
                className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-full pl-2.5 pr-1 py-1 text-xs"
              >
                <span className="text-[10px] text-muted-foreground">{label}:</span>
                <input
                  ref={editInputRef}
                  className="bg-transparent outline-none w-20 text-foreground font-medium text-xs caret-primary"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  aria-label={`Edit ${label}`}
                />
                <button onClick={commitEdit} className="ml-0.5 p-0.5 text-primary hover:text-primary/70 transition-colors" aria-label="Confirm">
                  <Check className="h-3 w-3" />
                </button>
                <button onClick={cancelEdit} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors" aria-label="Cancel">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                key={key}
                type="button"
                onClick={() => openEdit(key)}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border/60 text-xs text-foreground hover:bg-muted/80 hover:border-primary/30 active:scale-95 transition-all"
                aria-label={`Edit ${label}`}
              >
                <span className="text-[10px] text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
                <Pencil className="h-2.5 w-2.5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
              </button>
            )
          )}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={!amountValue.trim() || Number(amountValue) === 0}
        className="self-end mt-auto flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-5 py-2.5 rounded-lg disabled:opacity-30 transition-opacity active:scale-95"
        aria-label="Save"
      >
        <Check className="h-4 w-4" />
        Save
      </button>
    </div>
  );
}

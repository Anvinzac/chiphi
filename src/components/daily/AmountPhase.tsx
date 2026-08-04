import { useRef, useState } from "react";
import { ArrowLeft, Check, Delete, Pencil } from "lucide-react";
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

  const appendDigit = (digit: string) => {
    setAmountValue(`${amountValue}${digit}`.replace(/^0+(?=\d)/, ""));
  };

  const appendDecimal = () => {
    if (!amountValue.includes(".")) setAmountValue(amountValue ? `${amountValue}.` : "0.");
  };

  const removeLastDigit = () => setAmountValue(amountValue.slice(0, -1));
  const clearAmount = () => setAmountValue("");

  const supplier = match?.supplierName || verifyData?.supplierName || "";
  const category = match?.categoryName || verifyData?.categoryName || "";
  const subCategory = match?.subCategoryName || verifyData?.subCategoryName || "";
  const unitPrice = match?.unitPrice ?? verifyData?.unitPrice ?? 0;
  const unit = match?.unit || verifyData?.unit || "unit";
  const hasMeta = supplier || category || subCategory || unitPrice > 0;

  const allFields: { key: EditableField; label: string; value: string }[] = [
    { key: "supplierName", label: "Nhà cung cấp", value: supplier },
    { key: "categoryName", label: "Danh mục", value: category },
    { key: "subCategoryName", label: "Phân loại", value: subCategory },
    { key: "unitPrice", label: `/${unit}`, value: unitPrice > 0 ? unitPrice.toLocaleString("vi-VN") : "" },
  ];
  const fields = allFields.filter(f => f.value !== "");

  const keys = [
    [
      { label: "1", action: () => appendDigit("1") },
      { label: "2", action: () => appendDigit("2") },
      { label: "3", action: () => appendDigit("3") },
    ],
    [
      { label: "4", action: () => appendDigit("4") },
      { label: "5", action: () => appendDigit("5") },
      { label: "6", action: () => appendDigit("6") },
    ],
    [
      { label: "7", action: () => appendDigit("7") },
      { label: "8", action: () => appendDigit("8") },
      { label: "9", action: () => appendDigit("9") },
    ],
    [
      { label: ".", action: appendDecimal, muted: true },
      { label: "0", action: () => appendDigit("0") },
      { label: "⌫", action: removeLastDigit, muted: true },
    ],
  ];

  return (
    <div className="amount-phase-enter flex-1 flex flex-col px-5 pt-2 pb-3 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-11"
          aria-label="Quay lại"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="max-w-[12rem] truncate">{nameValue}</span>
        </button>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Số tiền</span>
      </div>

      <div className="flex items-end justify-between gap-3 mb-2 shrink-0">
        <div className="min-w-0 flex-1">
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            value={amountValue}
            onChange={(e) => setAmountValue(e.target.value.replace(/[^\d.]/g, ""))}
            onKeyDown={onKeyDown}
            className="sr-only"
            aria-label="Số tiền"
          />
          <button
            type="button"
            className="flex items-baseline max-w-full text-left cursor-text"
            onClick={() => amountRef.current?.focus()}
            aria-label="Nhập số tiền"
          >
            <span className="text-4xl font-display tabular-nums text-foreground leading-none break-all">
              {amountValue ? Number(amountValue).toLocaleString("vi-VN") : <span className="text-muted-foreground/25">0</span>}
            </span>
            <span className="text-2xl font-display text-muted-foreground/35 ml-1">.000</span>
          </button>
        </div>
        <span className="text-xs text-muted-foreground pb-1">nghìn ₫</span>
      </div>

      {hasMeta && (
        <div className="flex flex-wrap gap-1.5 mb-2 shrink-0">
          {fields.map(({ key, label, value }) => editingField === key ? (
            <div key={key} className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-[10px] text-muted-foreground">{label}:</span>
              <input
                ref={editInputRef}
                className="bg-transparent outline-none w-20 text-foreground font-medium text-xs caret-primary"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { commitEdit(); amountRef.current?.focus(); }
                  if (e.key === "Escape") { setEditingField(null); amountRef.current?.focus(); }
                }}
                onBlur={commitEdit}
                aria-label={`Sửa ${label}`}
              />
            </div>
          ) : (
            <button
              key={key}
              type="button"
              onClick={() => openEdit(key)}
              className="group flex items-center gap-1 px-2.5 py-1 rounded-xl bg-muted border border-border/60 text-[11px] text-foreground hover:border-primary/30 active:scale-95 transition-all"
              aria-label={`Sửa ${label}`}
            >
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
              <Pencil className="h-2.5 w-2.5 text-muted-foreground/50 group-hover:text-primary/70" />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2 mt-auto pt-1">
        {keys.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-2">
            {row.map(({ label, action, muted }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                className={`keypad-key rounded-2xl border text-xl font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  muted
                    ? "border-border/60 bg-background text-muted-foreground hover:bg-muted"
                    : "border-border/60 bg-card text-foreground hover:bg-muted"
                }`}
                aria-label={`Nhập ${label}`}
              >
                {label}
              </button>
            ))}
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={clearAmount}
            className="keypad-key rounded-2xl border border-border/60 bg-muted/70 text-xs font-medium text-muted-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Xóa số tiền"
          >
            C
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!amountValue.trim() || Number(amountValue) === 0}
            className="keypad-key col-span-2 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-warm disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Lưu"
          >
            <Check className="inline-block h-5 w-5 mr-1.5 -mt-0.5" />
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}

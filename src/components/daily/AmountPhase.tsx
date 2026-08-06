import { useRef, useState } from "react";
import { ArrowLeft, Check, Pencil, Plus, X } from "lucide-react";
import type { VerifyData } from "@/types/expense";
import { focusWithoutScroll } from "@/lib/focusWithoutScroll";
import ClearFieldButton from "./ClearFieldButton";

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
  noteValue: string;
  setNoteValue: (v: string) => void;
  lines: { amount: string; note: string }[];
  setLines: React.Dispatch<React.SetStateAction<{ amount: string; note: string }[]>>;
  amountRef: React.RefObject<HTMLInputElement>;
  match: MatchInfo | null;
  verifyData: VerifyData | null;
  setMatch: React.Dispatch<React.SetStateAction<MatchInfo | null>>;
  setVerifyData: React.Dispatch<React.SetStateAction<VerifyData | null>>;
  onBack: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSave: () => void;
  noteSuggestions?: string[];
}

type EditableField = "supplierName" | "categoryName" | "subCategoryName" | "unitPrice" | null;

export default function AmountPhase({
  nameValue,
  amountValue,
  setAmountValue,
  noteValue,
  setNoteValue,
  lines,
  setLines,
  amountRef,
  match,
  verifyData,
  setMatch,
  setVerifyData,
  onBack,
  onKeyDown,
  onSave,
  noteSuggestions = [],
}: AmountPhaseProps) {
  const [editingField, setEditingField] = useState<EditableField>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);

  const openEdit = (field: EditableField) => {
    if (!field) return;
    const current = match
      ? String(match[field as keyof MatchInfo] ?? "")
      : String(verifyData?.[field as keyof VerifyData] ?? "");
    setEditValue(current);
    setEditingField(field);
    setTimeout(() => focusWithoutScroll(editInputRef.current), 50);
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

  // Long-press backspace clears the whole amount
  const holdRef = useRef<number | null>(null);
  const heldRef = useRef(false);
  const startHold = () => {
    heldRef.current = false;
    holdRef.current = window.setTimeout(() => {
      heldRef.current = true;
      clearAmount();
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
    removeLastDigit();
  };

  const currentValid = !!amountValue.trim() && Number(amountValue) > 0;
  const canSave = currentValid || lines.length > 0;

  const addLine = () => {
    if (!currentValid) return;
    setLines(prev => [...prev, { amount: amountValue, note: noteValue.trim() }]);
    setAmountValue("");
    setNoteValue("");
  };

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
    ],
  ];

  return (
    <div className="flex-1 flex flex-col px-5 pt-2 pb-2 min-h-0 overflow-hidden">
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

      <div className="flex items-end justify-between gap-4 mb-2 shrink-0">
        <div className="min-w-0 flex-1">
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            value={amountValue}
            onChange={(e) => setAmountValue(e.target.value.replace(/[^\d.]/g, ""))}
            onKeyDown={onKeyDown}
            className="sr-only text-base"
            aria-label="Số tiền"
            onFocus={() => {
              window.scrollTo(0, 0);
              requestAnimationFrame(() => window.scrollTo(0, 0));
            }}
          />
          <div className="flex items-start gap-2">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-baseline text-left cursor-text whitespace-nowrap"
              onClick={() => {
                // Only focus the hidden field for hardware/desktop keyboards — avoid iOS zoom
                if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                  focusWithoutScroll(amountRef.current);
                }
              }}
              aria-label="Nhập số tiền"
            >
              <span className="text-4xl font-display tabular-nums text-foreground leading-none">
                {amountValue ? Number(amountValue).toLocaleString("vi-VN") : <span className="text-muted-foreground/25">0</span>}
              </span>
              <span className="text-2xl font-display text-muted-foreground/35 ml-1">.000</span>
            </button>
            <ClearFieldButton
              visible={amountValue.length > 0}
              onClear={clearAmount}
              label="Xóa số tiền"
              className="mt-1"
            />
          </div>
          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
            nghìn ₫
          </p>
        </div>

        <div className="amount-note group w-[min(42%,11.5rem)] shrink-0 self-stretch flex flex-col justify-end">
          <label
            htmlFor="expense-note"
            className="mb-1 block text-right text-[9px] uppercase tracking-[0.18em] text-muted-foreground/65 transition-colors group-focus-within:text-primary/80"
          >
            Ghi chú
          </label>
          <div className="flex items-center gap-1.5">
            <ClearFieldButton
              visible={noteValue.length > 0}
              onClear={() => {
                setNoteValue("");
                focusWithoutScroll(noteRef.current);
              }}
              label="Xóa ghi chú"
              size="sm"
            />
            <input
              ref={noteRef}
              id="expense-note"
              type="text"
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSave();
                }
              }}
              placeholder="Tùy chọn"
              maxLength={80}
              className="w-full min-w-0 bg-transparent text-right text-base font-medium leading-tight text-foreground placeholder:font-normal placeholder:text-muted-foreground/30 outline-none border-b border-border/45 pb-1.5 transition-[border-color,box-shadow] duration-200 caret-primary focus:border-primary/55 focus:shadow-[0_1px_0_0_hsl(var(--primary)/0.35)]"
              aria-label="Ghi chú thêm (tùy chọn)"
              autoComplete="off"
              enterKeyHint="done"
              onFocus={() => {
                window.scrollTo(0, 0);
                requestAnimationFrame(() => window.scrollTo(0, 0));
              }}
            />
          </div>
        </div>
      </div>

      {noteSuggestions.length > 0 && (
        <div className="-mt-1 mb-2 flex gap-1.5 overflow-x-auto pb-1 shrink-0 no-scrollbar">
          {noteSuggestions.map((s) => {
            const active = noteValue.trim().toLowerCase() === s.toLowerCase();
            return (
              <button
                key={s}
                type="button"
                onClick={() => setNoteValue(active ? "" : s)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-all active:scale-95 ${
                  active
                    ? "border-primary/50 bg-primary/15 text-primary font-medium"
                    : "border-border/60 bg-muted text-muted-foreground hover:border-primary/30"
                }`}
                aria-pressed={active}
                aria-label={`Ghi chú ${s}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}

      {hasMeta && (
        <div className="flex flex-wrap gap-1.5 mb-2 shrink-0">
          {fields.map(({ key, label, value }) => editingField === key ? (
            <div key={key} className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-[10px] text-muted-foreground">{label}:</span>
              <input
                ref={editInputRef}
                className="bg-transparent outline-none w-24 text-foreground font-medium text-base caret-primary"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { commitEdit(); focusWithoutScroll(amountRef.current); }
                  if (e.key === "Escape") { setEditingField(null); focusWithoutScroll(amountRef.current); }
                }}
                onBlur={commitEdit}
                aria-label={`Sửa ${label}`}
              />
              <ClearFieldButton
                visible={editValue.length > 0}
                size="sm"
                label={`Xóa ${label}`}
                onClear={() => {
                  setEditValue("");
                  focusWithoutScroll(editInputRef.current);
                }}
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

      <div className="mt-auto flex min-h-0 flex-1 flex-col justify-end gap-1.5 pt-1">
        {lines.length > 0 && (
          <div className="mb-1 max-h-24 space-y-1 overflow-y-auto no-scrollbar">
            {lines.map((l, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/50 px-2.5 py-1 text-xs"
              >
                <Plus className="h-3 w-3 shrink-0 text-primary/70" />
                <span className="font-display tabular-nums text-foreground">
                  {Number(l.amount).toLocaleString("vi-VN")}
                  <span className="text-muted-foreground/60">.000</span>
                </span>
                {l.note && <span className="truncate text-muted-foreground">{l.note}</span>}
                <button
                  type="button"
                  onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                  className="ml-auto shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Xóa dòng"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {keys.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-1.5">
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
            {ri === keys.length - 1 && (
              <button
                type="button"
                onClick={handleBackspaceClick}
                onPointerDown={startHold}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onPointerCancel={endHold}
                onContextMenu={(e) => e.preventDefault()}
                className="keypad-key rounded-2xl border border-border/60 bg-background text-xl font-medium text-muted-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Xóa số cuối (giữ để xóa hết)"
              >
                ⌫
              </button>
            )}
          </div>
        ))}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={addLine}
            disabled={!currentValid}
            className="keypad-key rounded-2xl border border-primary/40 bg-primary/10 font-medium text-primary shadow-sm disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Thêm dòng"
          >
            <Plus className="inline-block h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
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

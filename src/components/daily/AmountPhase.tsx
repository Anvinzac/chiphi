import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, Pencil, Plus, X } from "lucide-react";
import type { VerifyData } from "@/types/expense";
import type { ExpenseLine } from "@/lib/salaryEmployees";
import { focusWithoutScroll } from "@/lib/focusWithoutScroll";
import ClearFieldButton from "./ClearFieldButton";
import SaveEditsDialog from "./SaveEditsDialog";
import AmountNumpad from "./AmountNumpad";
import ThousandsMark from "./ThousandsMark";
import SalaryRoster from "./SalaryRoster";
import VendorPhase, { type VendorOption } from "./VendorPhase";
import { thousandsCaption } from "@/lib/thousandsSuffix";
import { useThousandsSuffix } from "@/hooks/useThousandsSuffix";

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
  onOpenMore: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSave: () => void;
  saving?: boolean;
  noteSuggestions?: string[];
  nestedLines?: ExpenseLine[];
  onClearNested?: () => void;
  onPickReceiptPhoto?: (file: File) => void;
  receiptAnalyzing?: boolean;
  vendors?: VendorOption[];
  frequentVendorIds?: string[];
  defaultVendorId?: string | null;
  onSelectVendor?: (vendor: { id: string | null; name: string }) => void;
  onCreateVendor?: (name: string) => Promise<VendorOption | null>;
}

type EditableField = "categoryName" | "subCategoryName" | "unitPrice" | null;

/** Match typed note query against full name or word initials (e.g. "ct" → "Cải thìa"). */
function matchesNoteQuery(name: string, query: string): boolean {
  const n = name.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (!q) return false;
  if (n.startsWith(q) || n.includes(q)) return true;
  const initials = n
    .split(/\s+/)
    .map(w => w.charAt(0))
    .join("");
  return initials.startsWith(q);
}

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
  onOpenMore,
  onKeyDown,
  onSave,
  saving = false,
  noteSuggestions = [],
  nestedLines = [],
  onClearNested,
  onPickReceiptPhoto,
  receiptAnalyzing = false,
  vendors = [],
  frequentVendorIds = [],
  defaultVendorId = null,
  onSelectVendor,
  onCreateVendor,
}: AmountPhaseProps) {
  const [thousandsMode] = useThousandsSuffix();
  const [editingField, setEditingField] = useState<EditableField>(null);
  const [editValue, setEditValue] = useState("");
  const [amountActive, setAmountActive] = useState(true);
  const editInputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const formScrollRef = useRef<HTMLDivElement>(null);
  const amountTrackRef = useRef<HTMLButtonElement>(null);
  const amountMeasureRef = useRef<HTMLSpanElement>(null);
  const receiptCameraRef = useRef<HTMLInputElement>(null);
  const [amountFontPx, setAmountFontPx] = useState(36);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [vendorPickerOpen, setVendorPickerOpen] = useState(false);
  const originalEditRef = useRef("");
  const choiceRef = useRef<"save" | "discard" | null>(null);

  const activateAmount = () => {
    setVendorPickerOpen(false);
    setAmountActive(true);
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      focusWithoutScroll(amountRef.current);
    }
  };

  const toggleVendorPicker = () => {
    if (vendorPickerOpen) {
      activateAmount();
      return;
    }
    setEditingField(null);
    setAmountActive(false);
    setVendorPickerOpen(true);
  };

  const appendDigit = (digit: string) => {
    if (confirmOpen) return;
    if (editingField) {
      if (chipIsDirty()) {
        setConfirmOpen(true);
        return;
      }
      setEditingField(null);
    }
    setAmountActive(true);
    setAmountValue(`${amountValue}${digit}`.replace(/^0+(?=\d)/, ""));
  };

  const appendDecimal = () => {
    if (confirmOpen) return;
    if (editingField) {
      if (chipIsDirty()) {
        setConfirmOpen(true);
        return;
      }
      setEditingField(null);
    }
    setAmountActive(true);
    if (!amountValue.includes(".")) setAmountValue(amountValue ? `${amountValue}.` : "0.");
  };

  const removeLastDigit = () => {
    setAmountActive(true);
    setAmountValue(amountValue.slice(0, -1));
  };
  const clearAmount = () => {
    setAmountActive(true);
    setAmountValue("");
    onClearNested?.();
  };

  const showReceiptTable = nestedLines.length > 0;
  const amountStarted = amountValue.length > 0 || nestedLines.length > 0;

  const openEdit = (field: EditableField) => {
    if (!field) return;
    const current = match
      ? String(match[field as keyof MatchInfo] ?? "")
      : String(verifyData?.[field as keyof VerifyData] ?? "");
    setEditValue(current);
    originalEditRef.current = current;
    setEditingField(field);
    setAmountActive(false);
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

  const chipIsDirty = () => {
    if (editingField === "unitPrice") {
      return (Number(editValue) || 0) !== (Number(originalEditRef.current) || 0);
    }
    return editValue.trim() !== originalEditRef.current.trim();
  };

  const cancelChipEdit = () => {
    setEditValue(originalEditRef.current);
    setEditingField(null);
    activateAmount();
  };

  const requestLeaveChip = () => {
    if (!editingField) return;
    if (!chipIsDirty()) {
      setEditingField(null);
      activateAmount();
      return;
    }
    setConfirmOpen(true);
  };

  const currentValid = !!amountValue.trim() && Number(amountValue) > 0;
  const canSave = !saving && !receiptAnalyzing && (currentValid || lines.length > 0 || nestedLines.length > 0);

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
  const hasMeta = category || subCategory || unitPrice > 0;

  const allFields: { key: EditableField; label: string; value: string }[] = [
    { key: "categoryName", label: "Danh mục", value: category },
    { key: "subCategoryName", label: "Phân loại", value: subCategory },
    { key: "unitPrice", label: `/${unit}`, value: unitPrice > 0 ? unitPrice.toLocaleString("vi-VN") : "" },
  ];
  const fields = allFields.filter(f => f.value !== "");

  const amountDisplay = amountValue ? Number(amountValue).toLocaleString("vi-VN") : "0";

  const noteQuery = noteValue.trim();
  const filteredNoteSuggestions = useMemo(() => {
    if (!noteQuery) return [];
    return noteSuggestions.filter(s => matchesNoteQuery(s, noteQuery));
  }, [noteSuggestions, noteQuery]);
  const showNoteSuggestions = filteredNoteSuggestions.length > 0;

  useLayoutEffect(() => {
    const track = amountTrackRef.current;
    const measure = amountMeasureRef.current;
    if (!track || !measure) return;

    const fit = () => {
      const max = 36;
      const min = 14;
      let size = max;
      measure.style.fontSize = `${size}px`;
      while (size > min && measure.scrollWidth > track.clientWidth) {
        size -= 1;
        measure.style.fontSize = `${size}px`;
      }
      setAmountFontPx(size);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(track);
    return () => ro.disconnect();
  }, [amountDisplay, amountActive]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-5 pt-2 pb-2">
      <div className="mb-2 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center">
        <button
          onClick={onBack}
          className="flex min-h-11 items-center gap-1 justify-self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Quay lại"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="max-w-[12rem] truncate">{nameValue}</span>
        </button>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Số tiền</span>
        <button
          type="button"
          onClick={onOpenMore}
          className="inline-flex min-h-8 items-center gap-1 justify-self-end rounded-lg border border-border bg-transparent px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/45 hover:text-foreground"
          aria-label="Thêm tùy chọn"
        >
          <span>Thêm…</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scrollable form — keeps meta chips above the fixed keypad */}
      <div
        ref={formScrollRef}
        className={`overflow-y-auto overscroll-contain no-scrollbar ${
          showReceiptTable || vendorPickerOpen ? "shrink-0" : "min-h-0 flex-1"
        }`}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              value={amountValue}
              onChange={e => setAmountValue(e.target.value.replace(/[^\d.]/g, ""))}
              onKeyDown={onKeyDown}
              className="sr-only text-base"
              aria-label="Số tiền"
              onFocus={() => {
                setVendorPickerOpen(false);
                setAmountActive(true);
                window.scrollTo(0, 0);
                requestAnimationFrame(() => window.scrollTo(0, 0));
              }}
            />
            <div className="flex min-w-0 items-start gap-2">
              <div className="min-w-0 flex-1">
                {onPickReceiptPhoto ? (
                  <input
                    ref={receiptCameraRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) onPickReceiptPhoto(file);
                    }}
                  />
                ) : null}
                <div className="flex min-w-0 items-center">
                  <button
                    ref={amountTrackRef}
                    type="button"
                    className={`flex w-max min-w-0 cursor-text justify-start overflow-hidden text-left ${
                      amountStarted
                        ? "max-w-[calc(100%-8.25rem)]"
                        : "max-w-[calc(100%-3.25rem)]"
                    }`}
                    onClick={activateAmount}
                    aria-label="Nhập số tiền"
                    aria-pressed={amountActive}
                  >
                    <span
                      ref={amountMeasureRef}
                      className="inline-flex max-w-none items-baseline whitespace-nowrap font-display tabular-nums leading-none text-foreground"
                      style={{ fontSize: amountFontPx }}
                    >
                      {amountValue ? (
                        amountDisplay
                      ) : (
                        <span className="text-muted-foreground/25">0</span>
                      )}
                      {amountActive && <span className="amount-caret" aria-hidden="true" />}
                      <ThousandsMark className="text-[0.65em] text-muted-foreground/35" />
                    </span>
                  </button>
                  <ClearFieldButton
                    visible={amountStarted}
                    onClear={clearAmount}
                    label="Xóa số tiền"
                    className="ml-1.5"
                  />
                  {onPickReceiptPhoto ? (
                    <>
                      <span
                        className={`amount-cam-gap${amountStarted ? " amount-cam-gap--open" : ""}`}
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        disabled={receiptAnalyzing}
                        onClick={() => receiptCameraRef.current?.click()}
                        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/12 text-primary transition-colors hover:bg-primary/18 disabled:opacity-50 ${
                          receiptAnalyzing ? "receipt-analyze-busy" : ""
                        }`}
                        aria-label="Tải ảnh biên lai để lấy số tiền"
                        aria-busy={receiptAnalyzing}
                      >
                        <Camera className="h-5 w-5" />
                      </button>
                    </>
                  ) : null}
                </div>
                <p className="mt-1 text-left text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                  {thousandsCaption(thousandsMode)}
                </p>
                <div className="amount-note group mt-2 flex items-center gap-1">
                  <input
                    ref={noteRef}
                    id="expense-note"
                    type="text"
                    value={noteValue}
                    onChange={e => setNoteValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!saving) onSave();
                      }
                    }}
                    placeholder="Ghi chú thêm"
                    maxLength={80}
                    className="min-w-0 flex-1 border-b border-border/45 bg-transparent pb-1.5 text-left text-base font-medium leading-tight text-foreground caret-primary outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-normal placeholder:text-muted-foreground/30 focus:border-primary/55 focus:shadow-[0_1px_0_0_hsl(var(--primary)/0.35)]"
                    aria-label="Ghi chú thêm"
                    autoComplete="off"
                    enterKeyHint="done"
                    onFocus={() => {
                      setVendorPickerOpen(false);
                      setAmountActive(false);
                      window.scrollTo(0, 0);
                      requestAnimationFrame(() => window.scrollTo(0, 0));
                    }}
                  />
                  <ClearFieldButton
                    visible={noteValue.length > 0}
                    onClear={() => {
                      setNoteValue("");
                      focusWithoutScroll(noteRef.current);
                    }}
                    label="Xóa ghi chú"
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-[min(42%,11.5rem)] shrink-0 flex-col items-end gap-1.5">
            {hasMeta &&
              fields.map(({ key, label, value }) =>
                editingField === key ? (
                  <div
                    key={key}
                    data-chip-edit
                    className="flex max-w-full items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs"
                  >
                    <span className="text-[10px] text-muted-foreground">{label}:</span>
                    <input
                      ref={editInputRef}
                      className="w-20 bg-transparent text-base font-medium text-foreground caret-primary outline-none"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          commitEdit();
                          activateAmount();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          requestLeaveChip();
                        }
                      }}
                      onBlur={e => {
                        const next = e.relatedTarget as Node | null;
                        if (e.currentTarget.closest("[data-chip-edit]")?.contains(next)) return;
                        requestLeaveChip();
                      }}
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
                    onClick={() => {
                      setVendorPickerOpen(false);
                      openEdit(key);
                    }}
                    className="group flex max-w-full items-center gap-1 rounded-xl border border-border/60 bg-muted px-2.5 py-1 text-[11px] text-foreground transition-all hover:border-primary/30 active:scale-95"
                    aria-label={`Sửa ${label}`}
                  >
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                    <span className="truncate font-medium">{value}</span>
                    <Pencil className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50 group-hover:text-primary/70" />
                  </button>
                ),
              )}
            <button
              type="button"
              onClick={toggleVendorPicker}
              aria-expanded={vendorPickerOpen}
              className={`group flex max-w-full items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] transition-all active:scale-95 ${
                vendorPickerOpen
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : supplier
                    ? "border-border/60 bg-muted text-foreground hover:border-primary/30"
                    : "border-dashed border-primary/35 bg-primary/5 text-primary hover:border-primary/50"
              }`}
              aria-label="Chọn nhà cung cấp"
            >
              <span className="shrink-0 text-[10px] text-muted-foreground">Nhà cung cấp</span>
              <span className={`truncate font-medium ${supplier && !vendorPickerOpen ? "" : "text-primary/80"}`}>
                {supplier || "Chọn"}
              </span>
              <Pencil className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50 group-hover:text-primary/70" />
            </button>
          </div>
        </div>

        <div
          className={`note-suggest-strip ${showNoteSuggestions ? "note-suggest-strip--open" : ""}`}
          aria-hidden={!showNoteSuggestions}
        >
          <div className="note-suggest-strip__inner">
            <div className="note-suggest-strip__row no-scrollbar" role="list" aria-label="Gợi ý phân loại">
              {filteredNoteSuggestions.map(s => {
                const active = noteValue.trim().toLowerCase() === s.toLowerCase();
                return (
                  <button
                    key={s}
                    type="button"
                    role="listitem"
                    onClick={() => setNoteValue(active ? "" : s)}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors active:scale-95 ${
                      active
                        ? "border-primary/50 bg-primary/15 font-medium text-primary"
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
          </div>
        </div>

        {!showReceiptTable && lines.length > 0 ? (
          <div className="mb-2 max-h-24 space-y-1 overflow-y-auto no-scrollbar">
            {lines.map((l, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/50 px-2.5 py-1 text-xs"
              >
                <Plus className="h-3 w-3 shrink-0 text-primary/70" />
                <span className="font-display tabular-nums text-foreground">
                  {Number(l.amount).toLocaleString("vi-VN")}
                  <ThousandsMark className="text-muted-foreground/60" />
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
        ) : null}
      </div>

      <div className={`mt-1.5 flex flex-col gap-1.5 ${showReceiptTable || vendorPickerOpen ? "min-h-0 flex-1" : "shrink-0"}`}>
        {vendorPickerOpen && onSelectVendor && onCreateVendor ? (
          <>
            <VendorPhase
              embedded
              vendors={vendors}
              frequentVendorIds={frequentVendorIds}
              defaultVendorId={defaultVendorId}
              selectedVendorId={match?.supplierId ?? verifyData?.supplierId ?? null}
              selectedVendorName={supplier}
              onSelect={onSelectVendor}
              onCreate={onCreateVendor}
              onDone={() => {
                setVendorPickerOpen(false);
                activateAmount();
              }}
            />
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="keypad-key w-full shrink-0 rounded-2xl bg-primary font-semibold text-primary-foreground shadow-warm disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Lưu"
              aria-busy={saving}
            >
              <Check className="mr-1.5 -mt-0.5 inline-block h-5 w-5" />
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
          </>
        ) : showReceiptTable ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar">
              <SalaryRoster lines={nestedLines} panel />
            </div>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="keypad-key w-full shrink-0 rounded-2xl bg-primary font-semibold text-primary-foreground shadow-warm disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Lưu"
              aria-busy={saving}
            >
              <Check className="mr-1.5 -mt-0.5 inline-block h-5 w-5" />
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
          </>
        ) : (
          <>
            <AmountNumpad
              onDigit={appendDigit}
              onDecimal={appendDecimal}
              onBackspace={removeLastDigit}
              onClear={clearAmount}
            />
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
                className="keypad-key col-span-2 rounded-2xl bg-primary font-semibold text-primary-foreground shadow-warm disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Lưu"
                aria-busy={saving}
              >
                <Check className="mr-1.5 -mt-0.5 inline-block h-5 w-5" />
                {saving ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </>
        )}
      </div>
      <SaveEditsDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);
          if (!next && choiceRef.current == null) {
            requestAnimationFrame(() => focusWithoutScroll(editInputRef.current));
          }
          choiceRef.current = null;
        }}
        onSave={() => {
          choiceRef.current = "save";
          commitEdit();
          activateAmount();
        }}
        onDiscard={() => {
          choiceRef.current = "discard";
          cancelChipEdit();
        }}
      />
    </div>
  );
}

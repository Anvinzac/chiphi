import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Pencil, Plus, X } from "lucide-react";
import type { VerifyData } from "@/types/expense";
import { focusWithoutScroll } from "@/lib/focusWithoutScroll";
import ClearFieldButton from "./ClearFieldButton";
import { SPAN_PRESETS, splitAmountAcrossPeriods, type SpanPresetKey } from "@/lib/expenseSpan";
import MoneyLabel from "./MoneyLabel";

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
  spanEnabled: boolean;
  setSpanEnabled: (v: boolean) => void;
  spanPreset: SpanPresetKey;
  setSpanPreset: (v: SpanPresetKey) => void;
  spanCustomPeriods: string;
  setSpanCustomPeriods: (v: string) => void;
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
  spanEnabled,
  setSpanEnabled,
  spanPreset,
  setSpanPreset,
  spanCustomPeriods,
  setSpanCustomPeriods,
}: AmountPhaseProps) {
  const [editingField, setEditingField] = useState<EditableField>(null);
  const [editValue, setEditValue] = useState("");
  const [amountActive, setAmountActive] = useState(true);
  const editInputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const customSpanRef = useRef<HTMLInputElement>(null);
  const formScrollRef = useRef<HTMLDivElement>(null);
  const spanSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!spanEnabled || spanPreset !== "custom") return;
    const id = window.setTimeout(() => {
      focusWithoutScroll(customSpanRef.current);
      customSpanRef.current?.select();
    }, 30);
    return () => window.clearTimeout(id);
  }, [spanEnabled, spanPreset]);

  useEffect(() => {
    if (!spanEnabled) return;
    const id = window.setTimeout(() => {
      const scroller = formScrollRef.current;
      const section = spanSectionRef.current;
      if (!scroller || !section) return;
      const sectionBottom = section.offsetTop + section.offsetHeight;
      const visibleBottom = scroller.scrollTop + scroller.clientHeight;
      if (sectionBottom > visibleBottom - 12) {
        scroller.scrollTo({
          top: Math.max(0, sectionBottom - scroller.clientHeight + 16),
          behavior: "smooth",
        });
      }
    }, 80);
    return () => window.clearTimeout(id);
  }, [spanEnabled]);

  const activateAmount = () => {
    setAmountActive(true);
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      focusWithoutScroll(amountRef.current);
    }
  };

  const appendDigit = (digit: string) => {
    setAmountActive(true);
    setAmountValue(`${amountValue}${digit}`.replace(/^0+(?=\d)/, ""));
  };

  const appendDecimal = () => {
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
  };

  const openEdit = (field: EditableField) => {
    if (!field) return;
    const current = match
      ? String(match[field as keyof MatchInfo] ?? "")
      : String(verifyData?.[field as keyof VerifyData] ?? "");
    setEditValue(current);
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

  const spanPeriodCount = useMemo(() => {
    if (!spanEnabled) return 0;
    if (spanPreset === "custom") {
      const n = Number(spanCustomPeriods);
      return Number.isFinite(n) ? Math.min(120, Math.max(2, Math.floor(n))) : 0;
    }
    return SPAN_PRESETS.find(p => p.key === spanPreset)?.periods ?? 0;
  }, [spanEnabled, spanPreset, spanCustomPeriods]);

  const spanPreview = useMemo(() => {
    if (!spanEnabled || spanPeriodCount < 2) return null;
    const totalK = [...lines, { amount: amountValue }]
      .map(l => Number(l.amount) || 0)
      .reduce((s, n) => s + n, 0);
    if (totalK <= 0) return null;
    const total = totalK * 1000;
    const parts = splitAmountAcrossPeriods(total, spanPeriodCount);
    return { total, first: parts[0], periods: spanPeriodCount };
  }, [spanEnabled, spanPeriodCount, lines, amountValue]);

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

  const amountDisplay = amountValue ? Number(amountValue).toLocaleString("vi-VN") : "0";
  const amountLen = amountDisplay.length;
  const amountSizeClass =
    amountLen >= 13
      ? "text-lg"
      : amountLen >= 11
        ? "text-xl"
        : amountLen >= 9
          ? "text-2xl"
          : amountLen >= 7
            ? "text-3xl"
            : "text-4xl";
  const zeroSizeClass =
    amountLen >= 13
      ? "text-sm"
      : amountLen >= 11
        ? "text-base"
        : amountLen >= 9
          ? "text-lg"
          : amountLen >= 7
            ? "text-xl"
            : "text-2xl";
  const noteWidthClass =
    amountLen >= 11
      ? "w-[4.75rem]"
      : amountLen >= 9
        ? "w-[min(28%,6.5rem)]"
        : amountLen >= 7
          ? "w-[min(34%,8.5rem)]"
          : "w-[min(42%,11.5rem)]";

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
    <div className="flex h-full min-h-0 flex-1 flex-col px-5 pt-2 pb-2">
      <div className="flex shrink-0 items-center justify-between mb-2">
        <button
          onClick={onBack}
          className="flex min-h-11 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Quay lại"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="max-w-[12rem] truncate">{nameValue}</span>
        </button>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Số tiền</span>
      </div>

      {/* Scrollable form — keeps meta/span chips above the fixed keypad */}
      <div
        ref={formScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar"
      >
        <div className="mb-2 flex items-end justify-between gap-3">
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
                setAmountActive(true);
                window.scrollTo(0, 0);
                requestAnimationFrame(() => window.scrollTo(0, 0));
              }}
            />
            <div className="relative min-w-0">
              <button
                type="button"
                className={`flex w-full min-w-0 cursor-text items-baseline whitespace-nowrap text-left ${
                  amountValue.length > 0 ? "pr-9" : ""
                }`}
                onClick={activateAmount}
                aria-label="Nhập số tiền"
                aria-pressed={amountActive}
              >
                <span
                  className={`shrink-0 font-display tabular-nums leading-none text-foreground ${amountSizeClass}`}
                >
                  {amountValue ? (
                    amountDisplay
                  ) : (
                    <span className="text-muted-foreground/25">0</span>
                  )}
                </span>
                {amountActive && (
                  <span
                    className={`amount-caret shrink-0 ${amountSizeClass}`}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`ml-0.5 shrink-0 font-display leading-none text-muted-foreground/35 ${zeroSizeClass}`}
                >
                  .000
                </span>
              </button>
              <ClearFieldButton
                visible={amountValue.length > 0}
                onClear={clearAmount}
                label="Xóa số tiền"
                className="absolute right-0 top-1/2 -translate-y-1/2"
              />
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
              nghìn ₫
            </p>
          </div>

          <div
            className={`amount-note group flex shrink-0 flex-col justify-end self-stretch transition-[width] duration-200 ${noteWidthClass}`}
          >
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
                onChange={e => setNoteValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSave();
                  }
                }}
                placeholder="Tùy chọn"
                maxLength={80}
                className="w-full min-w-0 border-b border-border/45 bg-transparent pb-1.5 text-right text-base font-medium leading-tight text-foreground caret-primary outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-normal placeholder:text-muted-foreground/30 focus:border-primary/55 focus:shadow-[0_1px_0_0_hsl(var(--primary)/0.35)]"
                aria-label="Ghi chú thêm (tùy chọn)"
                autoComplete="off"
                enterKeyHint="done"
                onFocus={() => {
                  setAmountActive(false);
                  window.scrollTo(0, 0);
                  requestAnimationFrame(() => window.scrollTo(0, 0));
                }}
              />
            </div>
          </div>
        </div>

        {noteSuggestions.length > 0 && (
          <div className="-mt-1 mb-2 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {noteSuggestions.map(s => {
              const active = noteValue.trim().toLowerCase() === s.toLowerCase();
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNoteValue(active ? "" : s)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-all active:scale-95 ${
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
        )}

        {hasMeta && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {fields.map(({ key, label, value }) =>
              editingField === key ? (
                <div
                  key={key}
                  className="flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs"
                >
                  <span className="text-[10px] text-muted-foreground">{label}:</span>
                  <input
                    ref={editInputRef}
                    className="w-24 bg-transparent text-base font-medium text-foreground caret-primary outline-none"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        commitEdit();
                        activateAmount();
                      }
                      if (e.key === "Escape") {
                        setEditingField(null);
                        activateAmount();
                      }
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
                  className="group flex items-center gap-1 rounded-xl border border-border/60 bg-muted px-2.5 py-1 text-[11px] text-foreground transition-all hover:border-primary/30 active:scale-95"
                  aria-label={`Sửa ${label}`}
                >
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                  <Pencil className="h-2.5 w-2.5 text-muted-foreground/50 group-hover:text-primary/70" />
                </button>
              ),
            )}
          </div>
        )}

        <div ref={spanSectionRef} className="mb-2 space-y-1.5">
          <button
            type="button"
            onClick={() => setSpanEnabled(!spanEnabled)}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
              spanEnabled
                ? "border-primary/40 bg-primary/10"
                : "border-border/60 bg-muted/40 hover:bg-muted"
            }`}
            aria-pressed={spanEnabled}
          >
            <span className="text-[11px] font-medium text-foreground">Chia nhiều kỳ</span>
            <span className="text-[10px] text-muted-foreground">
              {spanEnabled ? "Bật" : "Sửa lớn / đặt hàng số lượng lớn"}
            </span>
          </button>

          {spanEnabled && (
            <div className="space-y-1.5 rounded-xl border border-border/50 bg-card/80 px-2.5 py-2">
              <div className="flex flex-nowrap items-center gap-1 overflow-x-auto no-scrollbar">
                {SPAN_PRESETS.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setSpanPreset(p.key)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none transition-colors ${
                      spanPreset === p.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                {spanPreset === "custom" ? (
                  <label className="inline-flex min-w-[5.5rem] flex-1 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium leading-none text-primary-foreground">
                    <input
                      ref={customSpanRef}
                      type="text"
                      inputMode="numeric"
                      value={spanCustomPeriods}
                      onChange={e =>
                        setSpanCustomPeriods(e.target.value.replace(/\D/g, "").slice(0, 3))
                      }
                      onFocus={e => {
                        setAmountActive(false);
                        e.currentTarget.select();
                      }}
                      placeholder="…"
                      aria-label="Số kỳ tuỳ chỉnh"
                      className="span-chip-input w-full min-w-[2ch] max-w-[3.5ch] bg-transparent text-center tabular-nums text-primary-foreground caret-primary-foreground outline-none placeholder:text-primary-foreground/45"
                    />
                    <span className="shrink-0 opacity-85">kỳ</span>
                  </label>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSpanPreset("custom");
                      if (!spanCustomPeriods.trim()) setSpanCustomPeriods("3");
                    }}
                    className="min-w-[5.5rem] flex-1 rounded-full bg-muted px-2.5 py-1 text-left text-[11px] font-medium leading-none text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Tuỳ chỉnh
                  </button>
                )}
              </div>
              {spanPreview ? (
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Tổng{" "}
                  <MoneyLabel
                    amount={spanPreview.total}
                    className="inline text-[11px] font-display text-foreground"
                    smallClassName="text-[0.7em]"
                  />
                  {" · "}ghi kỳ này{" "}
                  <MoneyLabel
                    amount={spanPreview.first}
                    className="inline text-[11px] font-display text-foreground"
                    smallClassName="text-[0.7em]"
                  />{" "}
                  (1/{spanPreview.periods}). Các kỳ sau tự thêm cùng ngày hàng tháng.
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Nhập số tiền để xem phần ghi vào kỳ này.
                </p>
              )}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="mb-2 max-h-24 space-y-1 overflow-y-auto no-scrollbar">
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
      </div>

      {/* Fixed keypad — never covers chips above */}
      <div className="mt-1.5 flex shrink-0 flex-col gap-1.5">
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
                onContextMenu={e => e.preventDefault()}
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
            disabled={!canSave || (spanEnabled && spanPeriodCount < 2)}
            className="keypad-key col-span-2 rounded-2xl bg-primary font-semibold text-primary-foreground shadow-warm disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Lưu"
          >
            <Check className="mr-1.5 -mt-0.5 inline-block h-5 w-5" />
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}

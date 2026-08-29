import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, ChevronDown, ClipboardList, ImageIcon, Trash2 } from "lucide-react";
import {
  PAYMENT_METHODS,
  SCHEDULE_OPTIONS,
  type PaymentMethodId,
  type ScheduleRepeat,
} from "@/lib/expenseSchedule";
import { SPAN_PRESETS, splitAmountAcrossPeriods, type SpanPresetKey } from "@/lib/expenseSpan";
import { focusWithoutScroll } from "@/lib/focusWithoutScroll";
import MoneyLabel from "./MoneyLabel";

interface SchedulePhaseProps {
  amountValue: string;
  lines: { amount: string }[];
  rememberAmount: boolean;
  setRememberAmount: (v: boolean) => void;
  spanEnabled: boolean;
  setSpanEnabled: (v: boolean) => void;
  spanPreset: SpanPresetKey;
  setSpanPreset: (v: SpanPresetKey) => void;
  spanCustomPeriods: string;
  setSpanCustomPeriods: (v: string) => void;
  scheduleRepeat: ScheduleRepeat;
  setScheduleRepeat: (v: ScheduleRepeat) => void;
  paymentMethod: PaymentMethodId;
  setPaymentMethod: (v: PaymentMethodId) => void;
  paymentMethodNote: string;
  setPaymentMethodNote: (v: string) => void;
  receiptPreview: string | null;
  onPickReceipt: (file: File | null) => void;
  onBack: () => void;
  onSave: () => void;
  saving?: boolean;
  canSave: boolean;
  onApplyJson?: (raw: string) => Promise<boolean>;
  jsonHint?: string | null;
}

export default function SchedulePhase({
  amountValue,
  lines,
  rememberAmount,
  setRememberAmount,
  spanEnabled,
  setSpanEnabled,
  spanPreset,
  setSpanPreset,
  spanCustomPeriods,
  setSpanCustomPeriods,
  scheduleRepeat,
  setScheduleRepeat,
  paymentMethod,
  setPaymentMethod,
  paymentMethodNote,
  setPaymentMethodNote,
  receiptPreview,
  onPickReceipt,
  onBack,
  onSave,
  saving = false,
  canSave,
  onApplyJson,
  jsonHint,
}: SchedulePhaseProps) {
  const showNote = paymentMethod === "bank" || paymentMethod === "other" || paymentMethod === "borrow";
  const [receiptOpen, setReceiptOpen] = useState(() => !!receiptPreview);
  const [jsonPaste, setJsonPaste] = useState("");
  const [jsonBusy, setJsonBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const customSpanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (receiptPreview) setReceiptOpen(true);
  }, [receiptPreview]);

  useEffect(() => {
    if (!spanEnabled || spanPreset !== "custom") return;
    const id = window.setTimeout(() => {
      focusWithoutScroll(customSpanRef.current);
      customSpanRef.current?.select();
    }, 30);
    return () => window.clearTimeout(id);
  }, [spanEnabled, spanPreset]);

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

  const spanBlocksSave = spanEnabled && spanPeriodCount < 2;

  const applyJson = async (raw: string) => {
    if (!onApplyJson || jsonBusy) return;
    setJsonBusy(true);
    try {
      const ok = await onApplyJson(raw);
      if (ok) setJsonPaste("");
    } finally {
      setJsonBusy(false);
    }
  };

  const filledVnd = [...lines, { amount: amountValue }]
    .map(l => Number(l.amount) || 0)
    .reduce((s, n) => s + n, 0) * 1000;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-5 pt-2 pb-3">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Quay lại"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Số tiền
        </button>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Thêm
        </span>
        <span className="w-16" />
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain no-scrollbar pb-2">
        {onApplyJson ? (
          <section className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Dán JSON
            </p>
            <textarea
              value={jsonPaste}
              onChange={e => setJsonPaste(e.target.value)}
              onPaste={e => {
                const text = e.clipboardData.getData("text");
                if (!text.trim()) return;
                window.setTimeout(() => applyJson(text), 0);
              }}
              placeholder='{"employees":[{"account":"tphi","name":"T. Phi","amount":5000000}],"summary":{"total_amount":5000000}}'
              className="min-h-[96px] w-full rounded-xl border border-border bg-background p-3 font-mono text-[11px] outline-none focus:border-primary/40"
              spellCheck={false}
            />
            <input
              ref={jsonFileRef}
              type="file"
              accept="application/json,.json,text/plain"
              className="sr-only"
              onChange={async e => {
                const file = e.target.files?.[0];
                e.currentTarget.value = "";
                if (!file) return;
                try {
                  const text = await file.text();
                  setJsonPaste(text);
                  await applyJson(text);
                } catch {
                  /* ignore */
                }
              }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => jsonFileRef.current?.click()}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-[11px] font-medium text-foreground"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Chọn file
              </button>
              <button
                type="button"
                disabled={!jsonPaste.trim() || jsonBusy}
                onClick={() => applyJson(jsonPaste)}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 text-[11px] font-medium text-primary disabled:opacity-40"
              >
                {jsonBusy ? "Đang map…" : "Lấy tổng"}
              </button>
            </div>
            {jsonHint ? (
              <p className="text-[11px] leading-relaxed text-foreground">
                {jsonHint}
                {filledVnd > 0 ? (
                  <>
                    {" · "}
                    <MoneyLabel
                      amount={filledVnd}
                      className="inline font-display text-foreground"
                      smallClassName="text-[0.7em]"
                    />
                  </>
                ) : null}
              </p>
            ) : (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Dán hoặc chọn file. Tổng lấy từ{" "}
                <span className="font-medium text-foreground">summary.total_amount</span>
                {", "}hoặc cộng <span className="font-medium text-foreground">employees[].amount</span>.
              </p>
            )}
          </section>
        ) : null}

        <section>
          <button
            type="button"
            onClick={() => setRememberAmount(!rememberAmount)}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
              rememberAmount
                ? "border-primary/40 bg-primary/10"
                : "border-border/60 bg-muted/40 hover:bg-muted"
            }`}
            aria-pressed={rememberAmount}
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-foreground">Nhớ số tiền</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                {rememberAmount
                  ? "Lần sau nhập tên này sẽ điền sẵn"
                  : "Lưu làm số tiền mặc định lần sau"}
              </span>
            </span>
          </button>
        </section>

        <section className="space-y-1.5">
          <button
            type="button"
            onClick={() => setSpanEnabled(!spanEnabled)}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
              spanEnabled
                ? "border-primary/40 bg-primary/10"
                : "border-border/60 bg-muted/40 hover:bg-muted"
            }`}
            aria-pressed={spanEnabled}
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-foreground">Chia nhiều kỳ</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                {spanEnabled ? "Bật" : "Sửa lớn / đặt hàng số lượng lớn"}
              </span>
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
                  <label className="inline-flex w-full max-w-[9rem] min-w-[5.5rem] flex-1 basis-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium leading-none text-primary-foreground">
                    <input
                      ref={customSpanRef}
                      type="text"
                      inputMode="numeric"
                      value={spanCustomPeriods}
                      onChange={e =>
                        setSpanCustomPeriods(e.target.value.replace(/\D/g, "").slice(0, 3))
                      }
                      onFocus={e => e.currentTarget.select()}
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
                    className="w-full max-w-[9rem] min-w-[5.5rem] flex-1 basis-0 rounded-full bg-muted px-2.5 py-1 text-left text-[11px] font-medium leading-none text-muted-foreground transition-colors hover:text-foreground"
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
        </section>

        <section>
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Nhắc lịch
          </p>
          <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
            Sau khi lưu, hệ thống nhắc đúng ngày đó tháng sau, hoặc cùng thứ mỗi tuần / 2 tuần.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {SCHEDULE_OPTIONS.map(opt => {
              const active = scheduleRepeat === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScheduleRepeat(opt.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-primary/45 bg-primary/10"
                      : "border-border/60 bg-muted/40 hover:bg-muted"
                  }`}
                >
                  <span className={`block text-sm ${active ? "font-medium text-primary" : "text-foreground"}`}>
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{opt.hint}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Cách thanh toán
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_METHODS.map(m => {
              const active = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? "border-primary/50 bg-primary/15 font-medium text-primary"
                      : "border-border/60 bg-muted/70 text-foreground hover:border-primary/30"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          {showNote && (
            <input
              type="text"
              value={paymentMethodNote}
              onChange={e => setPaymentMethodNote(e.target.value)}
              placeholder={
                paymentMethod === "bank"
                  ? "Tên ngân hàng / STK…"
                  : paymentMethod === "borrow"
                    ? "Vay của ai…"
                    : "Ghi chú…"
              }
              className="mt-2 w-full border-b border-border/50 bg-transparent py-2 text-sm outline-none caret-primary placeholder:text-muted-foreground/40 focus:border-primary/50"
              autoComplete="off"
            />
          )}
        </section>

        <section>
          <button
            type="button"
            onClick={() => setReceiptOpen(open => !open)}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
              receiptOpen || receiptPreview
                ? "border-primary/40 bg-primary/10"
                : "border-border/60 bg-muted/40 hover:bg-muted"
            }`}
            aria-expanded={receiptOpen}
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-foreground">Biên lai</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                {receiptPreview ? "Đã gắn ảnh giao dịch" : "Chụp hoặc tải ảnh (tuỳ chọn)"}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                receiptOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {receiptOpen && (
            <div className="mt-2 space-y-2 rounded-xl border border-border/50 bg-card/80 px-2.5 py-2.5">
              {receiptPreview ? (
                <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/30">
                  <img
                    src={receiptPreview}
                    alt="Biên lai"
                    className="max-h-36 w-full bg-black/5 object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => onPickReceipt(null)}
                    className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-destructive shadow-sm"
                    aria-label="Xóa ảnh"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="px-1 py-2 text-center text-[11px] text-muted-foreground">
                  Ảnh xác nhận giao dịch. Cho phép camera hoặc chọn từ thư viện.
                </p>
              )}

              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={e => {
                  onPickReceipt(e.target.files?.[0] ?? null);
                  e.currentTarget.value = "";
                }}
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={e => {
                  onPickReceipt(e.target.files?.[0] ?? null);
                  e.currentTarget.value = "";
                }}
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-3 py-2.5 text-xs font-medium text-primary"
                >
                  <Camera className="h-4 w-4" />
                  Chụp ảnh
                </button>
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/60 px-3 py-2.5 text-xs font-medium text-foreground"
                >
                  <ImageIcon className="h-4 w-4" />
                  Thư viện
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={!canSave || saving || spanBlocksSave}
        className="mt-3 shrink-0 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-warm disabled:opacity-30"
      >
        <Check className="mr-1.5 -mt-0.5 inline-block h-4 w-4" />
        {saving ? "Đang lưu…" : "Lưu chi tiêu"}
      </button>
    </div>
  );
}

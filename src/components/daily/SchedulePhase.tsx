import { ArrowLeft, Check } from "lucide-react";
import {
  PAYMENT_METHODS,
  SCHEDULE_OPTIONS,
  type PaymentMethodId,
  type ScheduleRepeat,
} from "@/lib/expenseSchedule";

interface SchedulePhaseProps {
  scheduleRepeat: ScheduleRepeat;
  setScheduleRepeat: (v: ScheduleRepeat) => void;
  paymentMethod: PaymentMethodId;
  setPaymentMethod: (v: PaymentMethodId) => void;
  paymentMethodNote: string;
  setPaymentMethodNote: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function SchedulePhase({
  scheduleRepeat,
  setScheduleRepeat,
  paymentMethod,
  setPaymentMethod,
  paymentMethodNote,
  setPaymentMethodNote,
  onBack,
  onNext,
}: SchedulePhaseProps) {
  const showNote = paymentMethod === "bank" || paymentMethod === "other" || paymentMethod === "borrow";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-5 pt-2 pb-3">
      <div className="flex shrink-0 items-center justify-between mb-3">
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
          Nâng cao
        </span>
        <button
          type="button"
          onClick={onNext}
          className="flex min-h-11 items-center gap-1 text-xs font-medium text-primary"
        >
          Biên lai <Check className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar space-y-5 pb-2">
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
                  <span className="block text-[10px] text-muted-foreground mt-0.5">{opt.hint}</span>
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
      </div>
    </div>
  );
}

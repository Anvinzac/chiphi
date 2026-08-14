import { addMonths, addWeeks, format, getDate, getDay, parseISO } from "date-fns";

export type ScheduleRepeat = "none" | "weekly" | "biweekly" | "monthly";

export type PaymentMethodId = "cash" | "bank" | "momo" | "borrow" | "pay_later" | "other";

export const PAYMENT_METHODS: { id: PaymentMethodId; label: string; hint: string }[] = [
  { id: "cash", label: "Tiền mặt", hint: "Mặc định" },
  { id: "bank", label: "Chuyển khoản", hint: "Ngân hàng" },
  { id: "momo", label: "MoMo", hint: "Ví điện tử" },
  { id: "borrow", label: "Vay / mượn", hint: "Nợ người bán" },
  { id: "pay_later", label: "Trả sau", hint: "Ghi nợ" },
  { id: "other", label: "Khác", hint: "Tuỳ chọn" },
];

export const SCHEDULE_OPTIONS: { id: ScheduleRepeat; label: string; hint: string }[] = [
  { id: "none", label: "Không lặp", hint: "Chỉ ghi lần này" },
  { id: "monthly", label: "Mỗi tháng", hint: "Cùng ngày tháng sau" },
  { id: "weekly", label: "Mỗi tuần", hint: "Cùng thứ" },
  { id: "biweekly", label: "Mỗi 2 tuần", hint: "Cách 14 ngày" },
];

export type ExpenseScheduleRow = {
  id: string;
  user_id: string;
  item_name: string;
  item_id: string | null;
  category_id: string | null;
  sub_category_id: string | null;
  supplier_id: string | null;
  last_amount: number;
  payment_method: string;
  payment_method_note: string | null;
  repeat: Exclude<ScheduleRepeat, "none">;
  next_due: string;
  weekday: number | null;
  month_day: number | null;
  active: boolean;
};

export function nextDueFrom(dateStr: string, repeat: Exclude<ScheduleRepeat, "none">): string {
  const d = parseISO(dateStr);
  if (repeat === "weekly") return format(addWeeks(d, 1), "yyyy-MM-dd");
  if (repeat === "biweekly") return format(addWeeks(d, 2), "yyyy-MM-dd");
  return format(addMonths(d, 1), "yyyy-MM-dd");
}

export function scheduleAnchorFromDate(dateStr: string) {
  const d = parseISO(dateStr);
  return {
    weekday: getDay(d),
    month_day: getDate(d),
  };
}

export function scheduleMetaFromDate(dateStr: string, repeat: Exclude<ScheduleRepeat, "none">) {
  return {
    ...scheduleAnchorFromDate(dateStr),
    next_due: nextDueFrom(dateStr, repeat),
  };
}

export function reminderDisplayDate(
  nextDue: string,
  rangeStart: string,
  rangeEnd: string,
  today: string,
): string | null {
  if (nextDue >= rangeStart && nextDue <= rangeEnd) return nextDue;
  // Overdue: pin to today when today is in the visible range
  if (nextDue < today && today >= rangeStart && today <= rangeEnd) return today;
  return null;
}

export function isReminderPaymentId(id: string) {
  return id.startsWith("remind-");
}

export function reminderPaymentId(scheduleId: string) {
  return `remind-${scheduleId}`;
}

export const REPEAT_OPTIONS = SCHEDULE_OPTIONS.filter(
  (o): o is { id: Exclude<ScheduleRepeat, "none">; label: string; hint: string } => o.id !== "none",
);

export function scheduleRepeatLabel(repeat?: string | null) {
  return SCHEDULE_OPTIONS.find(o => o.id === repeat)?.label ?? "Lặp lại";
}

export function paymentMethodLabel(id?: string | null, note?: string | null) {
  const found = PAYMENT_METHODS.find(m => m.id === id);
  const base = found?.label ?? "Tiền mặt";
  return note?.trim() ? `${base} · ${note.trim()}` : base;
}

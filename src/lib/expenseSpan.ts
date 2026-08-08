/** Split large purchases across N accounting kỳ; post installments on day-of-month. */

export const SPAN_PRESETS = [
  { key: "3m", label: "3 tháng", periods: 3 },
  { key: "6m", label: "6 tháng", periods: 6 },
  { key: "1y", label: "1 năm", periods: 12 },
  { key: "2y", label: "2 năm", periods: 24 },
] as const;

export type SpanPresetKey = (typeof SPAN_PRESETS)[number]["key"] | "custom";

/** Equal VND split; remainder đồng distributed to the first installments. */
export function splitAmountAcrossPeriods(totalAmount: number, periodCount: number): number[] {
  const n = Math.max(2, Math.floor(periodCount));
  const total = Math.max(0, Math.round(totalAmount));
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function clampDayOfMonth(year: number, monthIndex: number, day: number): number {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(1, day), last);
}

/** Advance one calendar month, preserving day-of-month when possible. */
export function addMonthsKeepingDom(isoDate: string, dayOfMonth: number, months = 1): string {
  const [y, m] = isoDate.split("-").map(Number);
  const d = new Date(y, m - 1 + months, 1);
  const day = clampDayOfMonth(d.getFullYear(), d.getMonth(), dayOfMonth);
  d.setDate(day);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function dayOfMonthFromIso(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

export function formatSpanFractionLabel(index: number, periodCount: number): string {
  return `Kỳ ${index}/${periodCount}`;
}

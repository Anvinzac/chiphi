import { localDateKey, startOfLocalDay } from "@/lib/localDate";

export interface MonthlyOrderLine {
  num: string;
}

export function monthlyLineAmount(num: string): number {
  const n = Number.parseInt(String(num).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Empty day map for the monthly grid — no mock quantities. */
export function emptyMonthlyOrderByDate(rangeStart: Date, rangeEnd: Date): Map<string, MonthlyOrderLine[]> {
  const map = new Map<string, MonthlyOrderLine[]>();
  const cur = startOfLocalDay(rangeStart);
  const end = startOfLocalDay(rangeEnd);
  while (cur <= end) {
    map.set(localDateKey(cur), []);
    cur.setDate(cur.getDate() + 1);
  }
  return map;
}

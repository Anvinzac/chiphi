import type { MonthlyOrderCol } from "@/components/orders/MonthlyOrderGrid";
import type { MonthlyOrderLine } from "@/lib/mockMonthlyOrderGrid";

export const MONTHLY_ORDER_STORAGE_KEY = "chiphi:monthly-order-v1";
export const DEFAULT_MONTHLY_PIN = "6610";

export type MonthlyOrderSnapshot = {
  title: string;
  startInput: string;
  endInput: string;
  columns: MonthlyOrderCol;
  rangeMin: string;
  rangeMax: string;
  rangeEnabled: boolean;
  unitPriceDraft: string;
  cells: Record<string, string>;
  shareToken: string | null;
  updatedAt: string;
};

export function cellsFromOverrides(overrides: Map<string, MonthlyOrderLine[]>): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const [date, lines] of overrides) {
    const num = lines[0]?.num?.trim();
    if (num) cells[date] = num;
  }
  return cells;
}

export function overridesFromCells(cells: Record<string, string> | null | undefined): Map<string, MonthlyOrderLine[]> {
  const map = new Map<string, MonthlyOrderLine[]>();
  if (!cells) return map;
  for (const [date, num] of Object.entries(cells)) {
    if (num.trim()) map.set(date, [{ num: num.trim() }]);
    else map.set(date, []);
  }
  return map;
}

export function readMonthlyOrderLocal(): MonthlyOrderSnapshot | null {
  try {
    const raw = localStorage.getItem(MONTHLY_ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MonthlyOrderSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeMonthlyOrderLocal(snapshot: MonthlyOrderSnapshot) {
  try {
    localStorage.setItem(MONTHLY_ORDER_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* private mode */
  }
}

export function monthlyShareUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/m/${token}`;
}

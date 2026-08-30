import type { MonthlyOrderCol } from "@/components/orders/MonthlyOrderGrid";
import type { MonthlyOrderLine } from "@/lib/mockMonthlyOrderGrid";
import { ORDER_HUB_CATEGORIES } from "@/lib/importOrderCatalog";

export const MONTHLY_ORDER_STORAGE_KEY = "chiphi:monthly-order-v1";
export const DEFAULT_MONTHLY_PIN = "6610";
export const DEFAULT_MONTHLY_CATEGORY = "rau";

export type MonthlyOrderSnapshot = {
  categoryKey: string;
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
  vendorNotice: string;
  updatedAt: string;
};

export type MonthlyOrderListItem = {
  categoryKey: string;
  title: string;
  startInput: string;
  endInput: string;
  cells: Record<string, string>;
  shareToken: string | null;
  updatedAt: string;
};

export function monthlyOrderStorageKey(categoryKey: string): string {
  return `${MONTHLY_ORDER_STORAGE_KEY}:${categoryKey}`;
}

export function resolveMonthlyCategoryKey(raw: string | null | undefined): string {
  const key = (raw || "").trim();
  if (ORDER_HUB_CATEGORIES.some(c => c.key === key)) return key;
  return DEFAULT_MONTHLY_CATEGORY;
}

export function monthlyCategoryName(categoryKey: string): string {
  return ORDER_HUB_CATEGORIES.find(c => c.key === categoryKey)?.name || categoryKey;
}

export function monthlyOrderDefaultTitle(categoryKey: string): string {
  const name = monthlyCategoryName(categoryKey);
  return name ? `Đơn tháng ${name}` : "Đơn tháng";
}

export function inferMonthlyCategoryKey(title: string | null | undefined): string {
  const t = (title || "").toLowerCase();
  for (const cat of ORDER_HUB_CATEGORIES) {
    if (t.includes(cat.name.toLowerCase()) || t.includes(cat.key)) return cat.key;
  }
  return DEFAULT_MONTHLY_CATEGORY;
}

export function filledDayCount(cells: Record<string, string> | null | undefined): number {
  if (!cells) return 0;
  return Object.values(cells).filter(v => String(v).trim()).length;
}

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

function normalizeSnapshot(
  parsed: Partial<MonthlyOrderSnapshot> | null,
  fallbackKey = DEFAULT_MONTHLY_CATEGORY,
): MonthlyOrderSnapshot | null {
  if (!parsed || typeof parsed !== "object") return null;
  const categoryKey = resolveMonthlyCategoryKey(parsed.categoryKey || inferMonthlyCategoryKey(parsed.title) || fallbackKey);
  return {
    categoryKey,
    title: parsed.title || monthlyOrderDefaultTitle(categoryKey),
    startInput: parsed.startInput || "",
    endInput: parsed.endInput || "",
    columns: parsed.columns === 2 || parsed.columns === 3 || parsed.columns === 7 ? parsed.columns : 4,
    rangeMin: parsed.rangeMin || "16",
    rangeMax: parsed.rangeMax || "28",
    rangeEnabled: parsed.rangeEnabled ?? true,
    unitPriceDraft: parsed.unitPriceDraft || "",
    cells: parsed.cells ?? {},
    shareToken: parsed.shareToken ?? null,
    vendorNotice: parsed.vendorNotice || "",
    updatedAt: parsed.updatedAt || new Date().toISOString(),
  };
}

function readRaw(key: string): MonthlyOrderSnapshot | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return normalizeSnapshot(JSON.parse(raw) as Partial<MonthlyOrderSnapshot>);
  } catch {
    return null;
  }
}

function migrateLegacyLocal() {
  try {
    const destKey = monthlyOrderStorageKey(DEFAULT_MONTHLY_CATEGORY);
    if (localStorage.getItem(destKey)) return;
    const legacy = localStorage.getItem(MONTHLY_ORDER_STORAGE_KEY);
    if (!legacy) return;
    const parsed = normalizeSnapshot(JSON.parse(legacy) as Partial<MonthlyOrderSnapshot>, DEFAULT_MONTHLY_CATEGORY);
    if (!parsed) return;
    parsed.categoryKey = DEFAULT_MONTHLY_CATEGORY;
    if (!parsed.title || parsed.title === "Đơn tháng") {
      parsed.title = monthlyOrderDefaultTitle(DEFAULT_MONTHLY_CATEGORY);
    }
    localStorage.setItem(destKey, JSON.stringify(parsed));
  } catch {
    /* private mode */
  }
}

export function readMonthlyOrderLocal(categoryKey?: string): MonthlyOrderSnapshot | null {
  migrateLegacyLocal();
  const key = resolveMonthlyCategoryKey(categoryKey);
  const scoped = readRaw(monthlyOrderStorageKey(key));
  if (scoped) return { ...scoped, categoryKey: key };
  if (key === DEFAULT_MONTHLY_CATEGORY) {
    const legacy = readRaw(MONTHLY_ORDER_STORAGE_KEY);
    if (legacy) return { ...legacy, categoryKey: key };
  }
  return null;
}

export function writeMonthlyOrderLocal(snapshot: MonthlyOrderSnapshot) {
  const categoryKey = resolveMonthlyCategoryKey(snapshot.categoryKey);
  const next = { ...snapshot, categoryKey };
  try {
    localStorage.setItem(monthlyOrderStorageKey(categoryKey), JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

export function listMonthlyOrdersLocal(): MonthlyOrderListItem[] {
  migrateLegacyLocal();
  const items: MonthlyOrderListItem[] = [];
  for (const cat of ORDER_HUB_CATEGORIES) {
    const snap = readMonthlyOrderLocal(cat.key);
    if (!snap || filledDayCount(snap.cells) === 0) continue;
    items.push(listItemFromSnapshot(snap));
  }
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listItemFromSnapshot(snap: MonthlyOrderSnapshot): MonthlyOrderListItem {
  return {
    categoryKey: snap.categoryKey,
    title: snap.title,
    startInput: snap.startInput,
    endInput: snap.endInput,
    cells: snap.cells,
    shareToken: snap.shareToken,
    updatedAt: snap.updatedAt,
  };
}

export function mergeMonthlyLists(
  local: MonthlyOrderListItem[],
  remote: MonthlyOrderListItem[],
): MonthlyOrderListItem[] {
  const byKey = new Map<string, MonthlyOrderListItem>();
  for (const item of local) byKey.set(item.categoryKey, item);
  for (const item of remote) {
    const prev = byKey.get(item.categoryKey);
    if (!prev || item.updatedAt >= prev.updatedAt) byKey.set(item.categoryKey, item);
  }
  return Array.from(byKey.values())
    .filter(item => filledDayCount(item.cells) > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function monthlyShareUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/m/${token}`;
}

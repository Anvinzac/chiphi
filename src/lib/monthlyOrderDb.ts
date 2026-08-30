import { supabase } from "@/integrations/supabase/client";
import { isMissingColumn, isMissingOnConflict, isMissingRelation } from "@/lib/supabaseMissing";
import {
  DEFAULT_MONTHLY_CATEGORY,
  inferMonthlyCategoryKey,
  listItemFromSnapshot,
  resolveMonthlyCategoryKey,
  type MonthlyOrderListItem,
  type MonthlyOrderSnapshot,
} from "@/lib/monthlyOrderPersist";

type MonthlyOrderRow = {
  category_key?: string | null;
  title: string;
  range_start: string;
  range_end: string;
  columns: number;
  qty_min: number;
  qty_max: number;
  range_enabled: boolean;
  unit_price_thousands: string;
  cells: Record<string, string>;
  share_token: string | null;
  updated_at: string;
};

const SELECT_WITH_CAT =
  "category_key, title, range_start, range_end, columns, qty_min, qty_max, range_enabled, unit_price_thousands, cells, share_token, updated_at";
const SELECT_LEGACY =
  "title, range_start, range_end, columns, qty_min, qty_max, range_enabled, unit_price_thousands, cells, share_token, updated_at";

function rowToSnapshot(row: MonthlyOrderRow, fallbackKey = DEFAULT_MONTHLY_CATEGORY): MonthlyOrderSnapshot {
  const columns = (row.columns === 2 || row.columns === 3 || row.columns === 7 ? row.columns : 4) as
    MonthlyOrderSnapshot["columns"];
  const categoryKey = resolveMonthlyCategoryKey(row.category_key || inferMonthlyCategoryKey(row.title) || fallbackKey);
  return {
    categoryKey,
    title: row.title,
    startInput: row.range_start,
    endInput: row.range_end,
    columns,
    rangeMin: String(row.qty_min),
    rangeMax: String(row.qty_max),
    rangeEnabled: row.range_enabled,
    unitPriceDraft: row.unit_price_thousands || "",
    cells: row.cells ?? {},
    shareToken: row.share_token,
    updatedAt: row.updated_at,
  };
}

export async function loadMonthlyOrderRemote(
  userId: string,
  categoryKey: string,
): Promise<MonthlyOrderSnapshot | null> {
  const key = resolveMonthlyCategoryKey(categoryKey);
  const withCat = await supabase
    .from("monthly_orders")
    .select(SELECT_WITH_CAT)
    .eq("user_id", userId)
    .eq("category_key", key)
    .maybeSingle();
  if (!withCat.error) {
    if (!withCat.data) return null;
    return rowToSnapshot(withCat.data as MonthlyOrderRow, key);
  }
  if (isMissingRelation(withCat.error)) return null;
  if (!isMissingColumn(withCat.error)) throw withCat.error;

  const legacy = await supabase.from("monthly_orders").select(SELECT_LEGACY).eq("user_id", userId).maybeSingle();
  if (legacy.error) {
    if (isMissingRelation(legacy.error)) return null;
    throw legacy.error;
  }
  if (!legacy.data) return null;
  const snap = rowToSnapshot(legacy.data as MonthlyOrderRow);
  return snap.categoryKey === key ? snap : null;
}

export async function listMonthlyOrdersRemote(userId: string): Promise<MonthlyOrderListItem[]> {
  const withCat = await supabase.from("monthly_orders").select(SELECT_WITH_CAT).eq("user_id", userId);
  if (!withCat.error) {
    return ((withCat.data as MonthlyOrderRow[]) || []).map(row => listItemFromSnapshot(rowToSnapshot(row)));
  }
  if (isMissingRelation(withCat.error)) return [];
  if (!isMissingColumn(withCat.error)) throw withCat.error;

  const legacy = await supabase.from("monthly_orders").select(SELECT_LEGACY).eq("user_id", userId);
  if (legacy.error) {
    if (isMissingRelation(legacy.error)) return [];
    throw legacy.error;
  }
  return ((legacy.data as MonthlyOrderRow[]) || []).map(row => listItemFromSnapshot(rowToSnapshot(row)));
}

function payloadFromSnapshot(
  userId: string,
  snapshot: MonthlyOrderSnapshot,
  extras?: { shareToken?: string | null; pinHash?: string | null },
  includeCategory = true,
) {
  return {
    user_id: userId,
    ...(includeCategory ? { category_key: resolveMonthlyCategoryKey(snapshot.categoryKey) } : {}),
    title: snapshot.title,
    range_start: snapshot.startInput,
    range_end: snapshot.endInput,
    columns: snapshot.columns,
    qty_min: Number(snapshot.rangeMin) || 16,
    qty_max: Number(snapshot.rangeMax) || 26,
    range_enabled: snapshot.rangeEnabled,
    unit_price_thousands: snapshot.unitPriceDraft,
    cells: snapshot.cells,
    updated_at: new Date().toISOString(),
    ...(extras?.shareToken !== undefined ? { share_token: extras.shareToken } : {}),
    ...(extras?.pinHash !== undefined ? { pin_hash: extras.pinHash } : {}),
  };
}

export async function saveMonthlyOrderRemote(
  userId: string,
  snapshot: MonthlyOrderSnapshot,
  extras?: { shareToken?: string | null; pinHash?: string | null },
): Promise<void> {
  const keyed = payloadFromSnapshot(userId, snapshot, extras, true);
  const first = await supabase.from("monthly_orders").upsert(keyed, { onConflict: "user_id,category_key" });
  if (!first.error || isMissingRelation(first.error)) return;
  if (!isMissingColumn(first.error) && !isMissingOnConflict(first.error)) throw first.error;

  const key = resolveMonthlyCategoryKey(snapshot.categoryKey);
  if (key !== DEFAULT_MONTHLY_CATEGORY) return;

  const legacy = payloadFromSnapshot(userId, snapshot, extras, false);
  const second = await supabase.from("monthly_orders").upsert(legacy, { onConflict: "user_id" });
  if (second.error && !isMissingRelation(second.error)) throw second.error;
}

export type SharedMonthlyOrder = {
  title: string;
  rangeStart: string;
  rangeEnd: string;
  columns: MonthlyOrderSnapshot["columns"];
  cells: Record<string, string>;
  unitPriceDraft: string;
};

export async function fetchSharedMonthlyOrder(
  token: string,
  pin: string,
): Promise<SharedMonthlyOrder | null> {
  const { data, error } = await supabase.rpc("get_shared_monthly_order", {
    p_token: token,
    p_pin: pin,
  });
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const columns = (row.columns === 2 || row.columns === 3 || row.columns === 7 ? row.columns : 4) as
    MonthlyOrderSnapshot["columns"];
  return {
    title: row.title,
    rangeStart: row.range_start,
    rangeEnd: row.range_end,
    columns,
    cells: (row.cells ?? {}) as Record<string, string>,
    unitPriceDraft: String(row.unit_price_thousands ?? ""),
  };
}

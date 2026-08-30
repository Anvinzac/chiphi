import { supabase } from "@/integrations/supabase/client";
import { isMissingRelation } from "@/lib/supabaseMissing";
import type { MonthlyOrderSnapshot } from "@/lib/monthlyOrderPersist";

type MonthlyOrderRow = {
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

function rowToSnapshot(row: MonthlyOrderRow): MonthlyOrderSnapshot {
  const columns = (row.columns === 2 || row.columns === 3 || row.columns === 7 ? row.columns : 4) as
    MonthlyOrderSnapshot["columns"];
  return {
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

export async function loadMonthlyOrderRemote(userId: string): Promise<MonthlyOrderSnapshot | null> {
  const { data, error } = await supabase
    .from("monthly_orders")
    .select(
      "title, range_start, range_end, columns, qty_min, qty_max, range_enabled, unit_price_thousands, cells, share_token, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  if (!data) return null;
  return rowToSnapshot(data as MonthlyOrderRow);
}

export async function saveMonthlyOrderRemote(
  userId: string,
  snapshot: MonthlyOrderSnapshot,
  extras?: { shareToken?: string | null; pinHash?: string | null },
): Promise<void> {
  const payload = {
    user_id: userId,
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
  const { error } = await supabase.from("monthly_orders").upsert(payload, { onConflict: "user_id" });
  if (error && !isMissingRelation(error)) throw error;
}

export type SharedMonthlyOrder = {
  title: string;
  rangeStart: string;
  rangeEnd: string;
  columns: MonthlyOrderSnapshot["columns"];
  cells: Record<string, string>;
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
  };
}

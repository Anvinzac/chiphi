import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PaymentsRow = Database["public"]["Tables"]["payments"]["Row"];
type SubPaymentsRow = Database["public"]["Tables"]["sub_payments"]["Row"];
type CategoriesRow = Pick<Database["public"]["Tables"]["categories"]["Row"], "id" | "name" | "frequency" | "user_id">;
type SubCategoriesRow = Pick<
  Database["public"]["Tables"]["sub_categories"]["Row"],
  "id" | "name" | "category_id" | "parent_sub_category_id" | "user_id"
>;
type ItemsRow = Database["public"]["Tables"]["items"]["Row"];
type SuppliersRow = Pick<Database["public"]["Tables"]["suppliers"]["Row"], "id" | "name" | "contact" | "notes" | "user_id">;
type OrdersRow = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "id" | "title" | "status" | "created_at" | "updated_at" | "user_id"
>;
type OrderItemsRow = Pick<
  Database["public"]["Tables"]["order_items"]["Row"],
  "id" | "order_id" | "name" | "quantity" | "unit" | "status" | "sort_order" | "notice"
>;
type OrderCategoriesRow = Pick<
  Database["public"]["Tables"]["order_categories"]["Row"],
  "id" | "name" | "source_key" | "sort_order" | "user_id"
>;

export const SNAPSHOT_VERSION = 1;

export type SnapshotPayload = {
  version: number;
  payments: PaymentsRow[];
  sub_payments: SubPaymentsRow[];
  categories: CategoriesRow[];
  sub_categories: SubCategoriesRow[];
  items: ItemsRow[];
  suppliers: SuppliersRow[];
  expense_schedules: Record<string, unknown>[];
  expense_spans: Record<string, unknown>[];
  orders: OrdersRow[];
  order_items: OrderItemsRow[];
  order_categories: OrderCategoriesRow[];
};

export type SnapshotSlot = "today" | "yesterday";

export type SnapshotRecord = {
  userId: string;
  slot: SnapshotSlot;
  localDate: string;
  exportedAt: string;
  data: SnapshotPayload;
};

export type SnapshotMeta = {
  slot: SnapshotSlot;
  localDate: string;
  exportedAt: string;
  payments: number;
  orders: number;
};

const DB_NAME = "chiphi-lagged-snapshot";
const DB_VERSION = 1;
const STORE = "slots";
const LS_PREFIX = "chiphi:lagged-snapshot:";

export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isMissingRelation(error: { message?: string; code?: string } | null) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

function payloadWeight(data: SnapshotPayload) {
  return (
    data.payments.length +
    data.sub_payments.length +
    data.orders.length +
    data.items.length +
    data.suppliers.length
  );
}

function shouldReplaceToday(next: SnapshotPayload, existing: SnapshotRecord | null) {
  const nextWeight = payloadWeight(next);
  if (nextWeight > 0) return true;
  if (!existing) return true;
  return payloadWeight(existing.data) === 0;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: ["userId", "slot"] });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

async function idbGet(userId: string, slot: SnapshotSlot): Promise<SnapshotRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get([userId, slot]);
    req.onsuccess = () => resolve((req.result as SnapshotRecord | undefined) ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbPut(record: SnapshotRecord) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

function lsKey(userId: string, slot: SnapshotSlot) {
  return `${LS_PREFIX}${userId}:${slot}`;
}

function lsGet(userId: string, slot: SnapshotSlot): SnapshotRecord | null {
  try {
    const raw = localStorage.getItem(lsKey(userId, slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SnapshotRecord;
    if (!parsed?.data || parsed.slot !== slot) return null;
    return parsed;
  } catch {
    return null;
  }
}

function lsPut(record: SnapshotRecord) {
  localStorage.setItem(lsKey(record.userId, record.slot), JSON.stringify(record));
}

export async function getSnapshotSlot(userId: string, slot: SnapshotSlot): Promise<SnapshotRecord | null> {
  try {
    const fromIdb = await idbGet(userId, slot);
    if (fromIdb) return fromIdb;
  } catch {
    /* private mode / blocked IDB */
  }
  return lsGet(userId, slot);
}

async function putSnapshotSlot(record: SnapshotRecord) {
  try {
    await idbPut(record);
  } catch {
    lsPut(record);
  }
}

export async function readLaggedSnapshot(userId: string): Promise<SnapshotRecord | null> {
  return (await getSnapshotSlot(userId, "today")) ?? (await getSnapshotSlot(userId, "yesterday"));
}

export async function snapshotMeta(userId: string): Promise<{ today: SnapshotMeta | null; yesterday: SnapshotMeta | null }> {
  const [today, yesterday] = await Promise.all([
    getSnapshotSlot(userId, "today"),
    getSnapshotSlot(userId, "yesterday"),
  ]);
  const toMeta = (row: SnapshotRecord | null): SnapshotMeta | null =>
    row
      ? {
          slot: row.slot,
          localDate: row.localDate,
          exportedAt: row.exportedAt,
          payments: row.data.payments.length,
          orders: row.data.orders.length,
        }
      : null;
  return { today: toMeta(today), yesterday: toMeta(yesterday) };
}

export async function saveLaggedSnapshot(userId: string, data: SnapshotPayload) {
  const existingToday = await getSnapshotSlot(userId, "today");
  if (!shouldReplaceToday(data, existingToday)) return;

  const localDate = localDateKey();
  if (existingToday && existingToday.localDate < localDate) {
    await putSnapshotSlot({ ...existingToday, slot: "yesterday" });
  }

  await putSnapshotSlot({
    userId,
    slot: "today",
    localDate,
    exportedAt: new Date().toISOString(),
    data,
  });
}

async function requiredTable<T>(
  query: PromiseLike<{ data: T[] | null; error: { message?: string; code?: string } | null }>,
): Promise<{ ok: true; data: T[] } | { ok: false; error: string }> {
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message || "query failed" };
  return { ok: true, data: data ?? [] };
}

async function optionalTable<T>(
  query: PromiseLike<{ data: T[] | null; error: { message?: string; code?: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    if (isMissingRelation(error)) return [];
    throw new Error(error.message || "query failed");
  }
  return data ?? [];
}

export async function fetchLiveSnapshot(
  userId: string,
): Promise<{ ok: true; data: SnapshotPayload } | { ok: false; error: string }> {
  try {
    const [payments, subPayments, categories, subCategories, items, suppliers] = await Promise.all([
      requiredTable(supabase.from("payments").select("*").eq("user_id", userId)),
      requiredTable(supabase.from("sub_payments").select("*").eq("user_id", userId)),
      requiredTable(supabase.from("categories").select("id, name, frequency, user_id").eq("user_id", userId)),
      requiredTable(
        supabase
          .from("sub_categories")
          .select("id, name, category_id, parent_sub_category_id, user_id")
          .eq("user_id", userId),
      ),
      requiredTable(supabase.from("items").select("*").eq("user_id", userId)),
      requiredTable(supabase.from("suppliers").select("id, name, contact, notes, user_id").eq("user_id", userId)),
    ]);

    const failed = [payments, subPayments, categories, subCategories, items, suppliers].find(r => !r.ok);
    if (failed && !failed.ok) return { ok: false, error: failed.error };

    const [
      expense_schedules,
      expense_spans,
      orders,
      order_items,
      order_categories,
    ] = await Promise.all([
      optionalTable(supabase.from("expense_schedules").select("*").eq("user_id", userId)),
      optionalTable(supabase.from("expense_spans").select("*").eq("user_id", userId)),
      optionalTable(
        supabase
          .from("orders")
          .select("id, title, status, created_at, updated_at, user_id")
          .eq("user_id", userId),
      ),
      optionalTable(
        supabase
          .from("order_items")
          .select("id, order_id, name, quantity, unit, status, sort_order, notice"),
      ),
      optionalTable(
        supabase
          .from("order_categories")
          .select("id, name, source_key, sort_order, user_id")
          .eq("user_id", userId),
      ),
    ]);

    const orderIds = new Set((orders as OrdersRow[]).map(o => o.id));

    return {
      ok: true,
      data: {
        version: SNAPSHOT_VERSION,
        payments: payments.ok ? payments.data : [],
        sub_payments: subPayments.ok ? subPayments.data : [],
        categories: categories.ok ? categories.data : [],
        sub_categories: subCategories.ok ? subCategories.data : [],
        items: items.ok ? items.data : [],
        suppliers: suppliers.ok ? suppliers.data : [],
        expense_schedules,
        expense_spans,
        orders: orders as OrdersRow[],
        order_items: (order_items as OrderItemsRow[]).filter(i => orderIds.has(i.order_id)),
        order_categories: order_categories as OrderCategoriesRow[],
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không tải được dữ liệu";
    return { ok: false, error: message };
  }
}

export function paymentsWithSubsInRange(data: SnapshotPayload, start: string, end: string) {
  const byPayment = new Map<string, SubPaymentsRow[]>();
  for (const row of data.sub_payments) {
    const list = byPayment.get(row.payment_id);
    if (list) list.push(row);
    else byPayment.set(row.payment_id, [row]);
  }
  return data.payments
    .filter(p => p.date >= start && p.date <= end)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(p => ({
      id: p.id,
      date: p.date,
      total_amount: p.total_amount,
      supplier_id: p.supplier_id,
      sub_payments: byPayment.get(p.id) ?? [],
    }));
}

export function snapshotToPrettyJson(record: SnapshotRecord) {
  return JSON.stringify(
    {
      version: record.data.version,
      slot: record.slot,
      localDate: record.localDate,
      exportedAt: record.exportedAt,
      userId: record.userId,
      data: record.data,
    },
    null,
    2,
  );
}

export function downloadSnapshotJson(record: SnapshotRecord) {
  const blob = new Blob([snapshotToPrettyJson(record)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mise-backup-${record.slot}-${record.localDate}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

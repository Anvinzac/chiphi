/**
 * Full Postgres dump for the built-in admin account.
 * Usage: bun scripts/backup-admin-data.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const raw = readFileSync(join(root, ".env"), "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function isMissing(error: { message?: string; code?: string } | null) {
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

const PAGE = 1000;

function isSkipable(error: { message?: string; code?: string } | null) {
  if (isMissing(error)) return true;
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    code === "42501" ||
    msg.includes("permission denied") ||
    msg.includes("row-level security")
  );
}

async function fetchPaged(
  label: string,
  run: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message?: string; code?: string } | null }>,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) {
      if (isSkipable(error)) return [];
      throw new Error(`${label}: ${error.message}`);
    }
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function chunks<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = "admin@mise.local";
  const password = "AdminDemo2024!";

  const { data: session, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) throw authErr;
  const user = session.user;
  if (!user) throw new Error("Admin sign-in returned no user");

  const byUser = (table: string) =>
    fetchPaged(table, (from, to) =>
      supabase.from(table).select("*").eq("user_id", user.id).range(from, to),
    );

  const [
    categories,
    sub_categories,
    items,
    suppliers,
    payments,
    sub_payments,
    expense_schedules,
    expense_spans,
    orders,
    order_categories,
    order_ingredients,
    user_roles,
    admin_devices,
    salary_employees,
    salary_roster_meta,
    sub_payment_lines,
  ] = await Promise.all([
    byUser("categories"),
    byUser("sub_categories"),
    byUser("items"),
    byUser("suppliers"),
    byUser("payments"),
    byUser("sub_payments"),
    byUser("expense_schedules"),
    byUser("expense_spans"),
    byUser("orders"),
    byUser("order_categories"),
    byUser("order_ingredients"),
    byUser("user_roles"),
    byUser("admin_devices"),
    byUser("salary_employees"),
    byUser("salary_roster_meta"),
    byUser("sub_payment_lines"),
  ]);

  const spanIds = (expense_spans as { id: string }[]).map(r => r.id);
  const orderIds = (orders as { id: string }[]).map(r => r.id);

  const expense_span_installments: unknown[] = [];
  for (const batch of chunks(spanIds, 100)) {
    if (batch.length === 0) continue;
    const rows = await fetchPaged("expense_span_installments", (from, to) =>
      supabase.from("expense_span_installments").select("*").in("span_id", batch).range(from, to),
    );
    expense_span_installments.push(...rows);
  }

  const order_items: unknown[] = [];
  for (const batch of chunks(orderIds, 100)) {
    if (batch.length === 0) continue;
    const rows = await fetchPaged("order_items", (from, to) =>
      supabase.from("order_items").select("*").in("order_id", batch).range(from, to),
    );
    order_items.push(...rows);
  }

  const counts = {
    categories: categories.length,
    sub_categories: sub_categories.length,
    items: items.length,
    suppliers: suppliers.length,
    payments: payments.length,
    sub_payments: sub_payments.length,
    expense_schedules: expense_schedules.length,
    expense_spans: expense_spans.length,
    expense_span_installments: expense_span_installments.length,
    orders: orders.length,
    order_items: order_items.length,
    order_categories: order_categories.length,
    order_ingredients: order_ingredients.length,
    user_roles: user_roles.length,
    admin_devices: admin_devices.length,
    salary_employees: salary_employees.length,
    salary_roster_meta: salary_roster_meta.length,
    sub_payment_lines: sub_payment_lines.length,
  };

  const payload = {
    kind: "chiphi-admin-full-backup",
    exported_at: new Date().toISOString(),
    reason: "pre-nested-expense-lines-migration",
    user: { id: user.id, email: user.email, created_at: user.created_at },
    counts,
    tables: {
      categories,
      sub_categories,
      items,
      suppliers,
      payments,
      sub_payments,
      expense_schedules,
      expense_spans,
      expense_span_installments,
      orders,
      order_items,
      order_categories,
      order_ingredients,
      user_roles,
      admin_devices,
      salary_employees,
      salary_roster_meta,
      sub_payment_lines,
    },
  };

  const dir = join(root, "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = join(dir, `admin-pre-nested-expense-${stamp}.json`);
  writeFileSync(out, JSON.stringify(payload, null, 2));
  await supabase.auth.signOut();

  console.log(JSON.stringify({ path: out, userId: user.id, email: user.email, counts }, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

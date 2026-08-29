import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { isMissingRelation } from "@/lib/supabaseMissing";
import {
  readSalaryStore,
  salaryEmployeesKey,
  type SalaryEmployee,
  type SalaryEmployeesFile,
  type SalaryImportMeta,
  type SalaryPeriod,
  type SalarySummary,
} from "@/lib/salaryEmployees";

function asNum(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asOptionalNum(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function asOptionalStr(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text || undefined;
}

function periodFromJson(value: Json | null): SalaryPeriod | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const rec = value as Record<string, unknown>;
  const period: SalaryPeriod = {
    id: asOptionalStr(rec.id),
    start_date: asOptionalStr(rec.start_date),
    end_date: asOptionalStr(rec.end_date),
    label: asOptionalStr(rec.label),
  };
  return period.id || period.start_date || period.end_date || period.label ? period : undefined;
}

function summaryFromJson(value: Json | null): SalarySummary | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const rec = value as Record<string, unknown>;
  const summary: SalarySummary = {
    employee_count: asOptionalNum(rec.employee_count),
    total_amount: asOptionalNum(rec.total_amount),
    total_deposit: asOptionalNum(rec.total_deposit),
    total_transfer: asOptionalNum(rec.total_transfer),
  };
  return Object.values(summary).some(v => v != null) ? summary : undefined;
}

function metaFromRow(row: {
  period: Json | null;
  exported_at: string | null;
  summary: Json | null;
}): SalaryImportMeta | undefined {
  const period = periodFromJson(row.period);
  const exported_at = asOptionalStr(row.exported_at);
  const summary = summaryFromJson(row.summary);
  if (!period && !exported_at && !summary) return undefined;
  return { period, exported_at, summary };
}

function employeeFromRow(row: {
  id: string;
  account: string | null;
  name: string;
  amount: number;
  deposit: number | null;
  transfer_amount: number | null;
}): SalaryEmployee {
  return {
    id: row.id,
    name: row.name,
    amount: asNum(row.amount),
    ...(asOptionalStr(row.account) ? { account: asOptionalStr(row.account) } : {}),
    ...(asOptionalNum(row.deposit) != null ? { deposit: asOptionalNum(row.deposit) } : {}),
    ...(asOptionalNum(row.transfer_amount) != null ? { transfer_amount: asOptionalNum(row.transfer_amount) } : {}),
  };
}

async function fetchFromDb(userId: string): Promise<SalaryEmployeesFile | "missing"> {
  const [empRes, metaRes] = await Promise.all([
    supabase
      .from("salary_employees")
      .select("id, account, name, amount, deposit, transfer_amount, sort_index")
      .eq("user_id", userId)
      .order("sort_index", { ascending: true }),
    supabase
      .from("salary_roster_meta")
      .select("period, exported_at, summary")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (isMissingRelation(empRes.error) || isMissingRelation(metaRes.error)) return "missing";
  if (empRes.error) throw new Error(empRes.error.message);
  if (metaRes.error) throw new Error(metaRes.error.message);

  const employees = (empRes.data ?? []).map(employeeFromRow);
  const meta = metaRes.data ? metaFromRow(metaRes.data) : undefined;
  return { employees, meta };
}

function insertRows(userId: string, employees: SalaryEmployee[]) {
  return employees.map((row, sort_index) => ({
    id: row.id,
    user_id: userId,
    account: row.account ?? null,
    name: row.name,
    amount: row.amount,
    deposit: row.deposit ?? null,
    transfer_amount: row.transfer_amount ?? null,
    sort_index,
    updated_at: new Date().toISOString(),
  }));
}

async function writeMeta(userId: string, meta?: SalaryImportMeta) {
  if (!meta) return;
  const { error } = await supabase.from("salary_roster_meta").upsert({
    user_id: userId,
    period: (meta.period as Json | undefined) ?? null,
    exported_at: meta.exported_at ?? null,
    summary: (meta.summary as Json | undefined) ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (isMissingRelation(error)) return "missing";
    throw new Error(error.message);
  }
  return "ok";
}

export async function persistSalaryStoreToDb(
  userId: string,
  employees: SalaryEmployee[],
  meta?: SalaryImportMeta,
): Promise<"ok" | "missing"> {
  const existing = await supabase.from("salary_employees").select("id").eq("user_id", userId);
  if (existing.error) {
    if (isMissingRelation(existing.error)) return "missing";
    throw new Error(existing.error.message);
  }
  const oldIds = (existing.data ?? []).map(row => row.id);
  if (employees.length > 0) {
    const ins = await supabase.from("salary_employees").insert(insertRows(userId, employees));
    if (ins.error) {
      if (isMissingRelation(ins.error)) return "missing";
      throw new Error(ins.error.message);
    }
  }
  if (oldIds.length > 0) {
    const del = await supabase.from("salary_employees").delete().eq("user_id", userId).in("id", oldIds);
    if (del.error) {
      if (isMissingRelation(del.error)) return "missing";
      throw new Error(del.error.message);
    }
  }
  const metaResult = await writeMeta(userId, meta);
  if (metaResult === "missing") return "missing";
  return "ok";
}

async function migrateLocalIfEmpty(userId: string, db: SalaryEmployeesFile) {
  if (db.employees.length > 0 || db.meta) return db;
  const local = readSalaryStore(userId);
  if (local.employees.length === 0 && !local.meta) return db;
  const written = await persistSalaryStoreToDb(userId, local.employees, local.meta);
  if (written === "missing") return local;
  try {
    localStorage.removeItem(salaryEmployeesKey(userId));
  } catch {
    /* ignore */
  }
  return local;
}

let rosterCache: { userId: string | null; store: SalaryEmployeesFile } | null = null;
let rosterInflight: { userId: string | null; promise: Promise<SalaryEmployeesFile> } | null = null;

export function invalidateSalaryStoreCache() {
  rosterCache = null;
}

async function loadSalaryStoreUncached(userId: string | null): Promise<SalaryEmployeesFile> {
  if (!userId) return readSalaryStore(userId);
  try {
    const db = await fetchFromDb(userId);
    if (db === "missing") return readSalaryStore(userId);
    return await migrateLocalIfEmpty(userId, db);
  } catch (err) {
    console.warn("loadSalaryStore", err);
    return readSalaryStore(userId);
  }
}

export async function loadSalaryStore(
  userId: string | null,
  opts?: { fresh?: boolean },
): Promise<SalaryEmployeesFile> {
  if (!opts?.fresh && rosterCache && rosterCache.userId === userId) return rosterCache.store;
  if (rosterInflight && rosterInflight.userId === userId) return rosterInflight.promise;
  const promise = loadSalaryStoreUncached(userId).then(store => {
    rosterCache = { userId, store };
    return store;
  });
  rosterInflight = { userId, promise };
  try {
    return await promise;
  } finally {
    if (rosterInflight?.promise === promise) rosterInflight = null;
  }
}

export async function saveSalaryStore(
  userId: string | null,
  employees: SalaryEmployee[],
  meta?: SalaryImportMeta,
): Promise<SalaryEmployeesFile> {
  const file: SalaryEmployeesFile = meta ? { employees, meta } : { employees };
  if (!userId) {
    const { writeSalaryStore } = await import("@/lib/salaryEmployees");
    writeSalaryStore(userId, employees, meta);
    rosterCache = { userId, store: file };
    return file;
  }
  try {
    const written = await persistSalaryStoreToDb(userId, employees, meta);
    if (written === "missing") {
      const { writeSalaryStore } = await import("@/lib/salaryEmployees");
      writeSalaryStore(userId, employees, meta);
      rosterCache = { userId, store: file };
      return file;
    }
    try {
      localStorage.removeItem(salaryEmployeesKey(userId));
    } catch {
      /* ignore */
    }
    rosterCache = { userId, store: file };
    return file;
  } catch (err) {
    console.warn("saveSalaryStore", err);
    const { writeSalaryStore } = await import("@/lib/salaryEmployees");
    writeSalaryStore(userId, employees, meta);
    rosterCache = { userId, store: file };
    return file;
  }
}

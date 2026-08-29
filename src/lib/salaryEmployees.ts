import { foldCategoryName } from "./categoryVisuals";

export type SalaryEmployee = {
  id: string;
  /** Login username from the salary app. */
  account?: string;
  /** Display name. */
  name: string;
  /** Published gross salary (VND). */
  amount: number;
  /** Optional advance held back (VND). */
  deposit?: number;
  /** Optional net = amount − deposit (VND). */
  transfer_amount?: number;
};

export type SalaryLine = Pick<SalaryEmployee, "id" | "name" | "amount">;

export type ExpenseLine = SalaryLine & {
  attrs?: Record<string, unknown>;
};

/** Map parsed payroll employees onto generic nested-line rows (attrs hold salary extras). */
export function salaryEmployeesToLineRows(employees: Omit<SalaryEmployee, "id">[]) {
  return employees.map((row, sort_index) => {
    const attrs: Record<string, unknown> = {};
    if (row.account) attrs.account = row.account;
    if (row.deposit != null) attrs.deposit = row.deposit;
    if (row.transfer_amount != null) attrs.transfer_amount = row.transfer_amount;
    return { name: row.name, amount: row.amount, sort_index, attrs };
  });
}

export function employeesToExpenseLines(employees: SalaryEmployee[]): ExpenseLine[] {
  return employees.map(row => {
    const attrs: Record<string, unknown> = {};
    if (row.account) attrs.account = row.account;
    if (row.deposit != null) attrs.deposit = row.deposit;
    if (row.transfer_amount != null) attrs.transfer_amount = row.transfer_amount;
    return {
      id: row.id,
      name: row.name,
      amount: row.amount,
      ...(Object.keys(attrs).length ? { attrs } : {}),
    };
  });
}

export function normalizeSubPaymentLines(raw: unknown): ExpenseLine[] {
  if (!Array.isArray(raw)) return [];
  return [...raw]
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const rec = row as Record<string, unknown>;
      const name = typeof rec.name === "string" ? rec.name.trim() : "";
      if (!name) return null;
      const amount = Number(rec.amount);
      const attrs =
        rec.attrs && typeof rec.attrs === "object" && !Array.isArray(rec.attrs)
          ? (rec.attrs as Record<string, unknown>)
          : undefined;
      return {
        id: typeof rec.id === "string" && rec.id ? rec.id : `${name}-${index}`,
        name,
        amount: Number.isFinite(amount) ? amount : 0,
        sort_index: Number.isFinite(Number(rec.sort_index)) ? Number(rec.sort_index) : index,
        ...(attrs && Object.keys(attrs).length ? { attrs } : {}),
      };
    })
    .filter((row): row is ExpenseLine & { sort_index: number } => row != null)
    .sort((a, b) => a.sort_index - b.sort_index)
    .map(({ sort_index: _sort, ...row }) => row);
}

export type SalaryPeriod = {
  id?: string;
  start_date?: string;
  end_date?: string;
  label?: string;
};

export type SalarySummary = {
  employee_count?: number;
  total_amount?: number;
  total_deposit?: number;
  total_transfer?: number;
};

export type SalaryImportMeta = {
  period?: SalaryPeriod;
  exported_at?: string;
  summary?: SalarySummary;
};

export type SalaryEmployeesFile = {
  employees: SalaryEmployee[];
  meta?: SalaryImportMeta;
};

export const SALARY_EMPLOYEES_EVENT = "chiphi:salary-employees";
const STORAGE_PREFIX = "chiphi:salary-employees:";

export function isSalaryExpense(itemName?: string | null, categoryName?: string | null) {
  return [itemName, categoryName]
    .filter(Boolean)
    .map(n => foldCategoryName(n as string))
    .some(k => k === "luong nv" || k === "luong");
}

export function salaryEmployeesKey(userId?: string | null) {
  return `${STORAGE_PREFIX}${userId || "local"}`;
}

export function parseMoneyValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase().replace(/\s/g, "");
  if (!raw) return null;
  if (/tr$/.test(raw) || /trieu$/.test(raw)) {
    const n = Number(raw.replace(/trieu$|tr$/, "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 1_000_000) : null;
  }
  if (/k$/.test(raw) || /nghin$/.test(raw) || /ngan$/.test(raw)) {
    const n = Number(raw.replace(/nghin$|ngan$|k$/, "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) : null;
  }
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function strField(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text || undefined;
}

function moneyField(row: Record<string, unknown>, key: string): number | undefined {
  const n = parseMoneyValue(row[key]);
  return n == null ? undefined : n;
}

export function mapSalaryEmployee(row: unknown): Omit<SalaryEmployee, "id"> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const account = strField(rec, "account");
  const name = strField(rec, "name") || account;
  const amount = moneyField(rec, "amount");
  if (!name || amount == null) return null;
  const deposit = moneyField(rec, "deposit");
  let transfer_amount = moneyField(rec, "transfer_amount");
  if (transfer_amount == null && deposit != null) {
    transfer_amount = Math.max(0, amount - deposit);
  }
  return {
    account,
    name,
    amount,
    ...(deposit != null ? { deposit } : {}),
    ...(transfer_amount != null ? { transfer_amount } : {}),
  };
}

function readPeriod(value: unknown): SalaryPeriod | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rec = value as Record<string, unknown>;
  const period: SalaryPeriod = {
    id: strField(rec, "id"),
    start_date: strField(rec, "start_date"),
    end_date: strField(rec, "end_date"),
    label: strField(rec, "label"),
  };
  return period.id || period.start_date || period.end_date || period.label ? period : undefined;
}

function readSummary(value: unknown): SalarySummary | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rec = value as Record<string, unknown>;
  const summary: SalarySummary = {
    employee_count: moneyField(rec, "employee_count"),
    total_amount: moneyField(rec, "total_amount"),
    total_deposit: moneyField(rec, "total_deposit"),
    total_transfer: moneyField(rec, "total_transfer"),
  };
  return Object.values(summary).some(v => v != null) ? summary : undefined;
}

function employeesFromPayload(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return null;
  const list = (data as Record<string, unknown>).employees;
  return Array.isArray(list) ? list : null;
}

export type ParseSalaryJsonResult =
  | { ok: true; employees: Omit<SalaryEmployee, "id">[]; meta?: SalaryImportMeta }
  | { ok: false; error: string };

export function parseSalaryJson(raw: string): ParseSalaryJsonResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Chưa có JSON để dán" };
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "JSON không hợp lệ" };
  }
  const list = employeesFromPayload(data);
  if (!list) {
    return { ok: false, error: "Không thấy employees[] — dán file xuất lương (schema v1)" };
  }

  const employees = list.map(mapSalaryEmployee).filter((row): row is Omit<SalaryEmployee, "id"> => row != null);
  if (employees.length === 0) {
    return { ok: false, error: "Không map được nhân viên — cần name hoặc account, và amount" };
  }

  let meta: SalaryImportMeta | undefined;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const rec = data as Record<string, unknown>;
    const period = readPeriod(rec.period);
    const exported_at = strField(rec, "exported_at");
    const summary = readSummary(rec.summary);
    if (period || exported_at || summary) meta = { period, exported_at, summary };
  }

  return { ok: true, employees, meta };
}

function coerceEmployee(row: unknown): SalaryEmployee | null {
  const mapped = mapSalaryEmployee(row);
  if (!mapped) return null;
  const rec = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  const id = typeof rec.id === "string" && rec.id ? rec.id : crypto.randomUUID();
  return { id, ...mapped };
}

export function readSalaryStore(userId?: string | null): SalaryEmployeesFile {
  try {
    const raw = localStorage.getItem(salaryEmployeesKey(userId));
    if (!raw) return { employees: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return { employees: parsed.map(coerceEmployee).filter((row): row is SalaryEmployee => row != null) };
    }
    if (!parsed || typeof parsed !== "object") return { employees: [] };
    const rec = parsed as Record<string, unknown>;
    const employees = Array.isArray(rec.employees)
      ? rec.employees.map(coerceEmployee).filter((row): row is SalaryEmployee => row != null)
      : [];
    const blob =
      rec.meta && typeof rec.meta === "object" ? (rec.meta as Record<string, unknown>) : rec;
    const meta: SalaryImportMeta = {
      period: readPeriod(blob.period),
      exported_at: strField(blob, "exported_at"),
      summary: readSummary(blob.summary),
    };
    const hasMeta = Boolean(meta.period || meta.exported_at || meta.summary);
    return { employees, meta: hasMeta ? meta : undefined };
  } catch {
    return { employees: [] };
  }
}

export function readSalaryEmployees(userId?: string | null): SalaryEmployee[] {
  return readSalaryStore(userId).employees;
}

export function writeSalaryStore(
  userId: string | null | undefined,
  employees: SalaryEmployee[],
  meta?: SalaryImportMeta,
) {
  const file: SalaryEmployeesFile = meta ? { employees, meta } : { employees };
  localStorage.setItem(salaryEmployeesKey(userId), JSON.stringify(file));
  window.dispatchEvent(new Event(SALARY_EMPLOYEES_EVENT));
}

export function writeSalaryEmployees(userId: string | null | undefined, employees: SalaryEmployee[]) {
  const prev = readSalaryStore(userId);
  writeSalaryStore(userId, employees, prev.meta);
}

export function newSalaryEmployee(
  name: string,
  amount: number,
  extra?: Pick<SalaryEmployee, "account" | "deposit" | "transfer_amount">,
): SalaryEmployee {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    amount: Math.max(0, Math.round(amount)),
    ...extra,
  };
}

import { describe, expect, it } from "vitest";
import { isSalaryExpense } from "./salaryRoster";
import { mapSalaryEmployee, normalizeSubPaymentLines, parseSalaryJson, salaryEmployeesToLineRows, salaryJsonTotalVnd } from "./salaryEmployees";
import { thousandsFromVnd } from "./vndThousands";

describe("isSalaryExpense", () => {
  it("matches Lương NV on the item or category", () => {
    expect(isSalaryExpense("Lương NV", undefined)).toBe(true);
    expect(isSalaryExpense("Chi tháng", "Lương NV")).toBe(true);
    expect(isSalaryExpense("Đi chợ", "Rau")).toBe(false);
  });
});

const EXPORT_V1 = {
  schema: {
    version: "1.0",
    description: "Payroll export",
    employee_fields: {
      account: "Login username",
      name: "Display name",
      amount: "Published gross salary (VND)",
      deposit: "Optional advance held back",
      transfer_amount: "Optional net = amount - deposit",
    },
    import_notes: ["Chiphi maps employees[]"],
  },
  period: { id: "2026-08", start_date: "2026-08-01", end_date: "2026-08-31", label: "Tháng 8/2026" },
  exported_at: "2026-08-29T05:00:00.000Z",
  employees: [
    { account: "tphi", name: "T. Phi", amount: 5_000_000 },
    { account: "lan", name: "Lan", amount: 4_000_000, deposit: 500_000, transfer_amount: 3_500_000 },
    { account: "minh", amount: 3_000_000, deposit: 200_000 },
  ],
  summary: {
    employee_count: 3,
    total_amount: 12_000_000,
    total_deposit: 700_000,
    total_transfer: 11_300_000,
  },
};

describe("parseSalaryJson schema v1", () => {
  it("maps the payroll export envelope", () => {
    const result = parseSalaryJson(JSON.stringify(EXPORT_V1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta?.period?.label).toBe("Tháng 8/2026");
    expect(result.meta?.summary?.employee_count).toBe(3);
    expect(result.employees).toEqual([
      { account: "tphi", name: "T. Phi", amount: 5_000_000 },
      { account: "lan", name: "Lan", amount: 4_000_000, deposit: 500_000, transfer_amount: 3_500_000 },
      { account: "minh", name: "minh", amount: 3_000_000, deposit: 200_000, transfer_amount: 2_800_000 },
    ]);
  });

  it("accepts a bare employees array with the same fields", () => {
    const result = parseSalaryJson(JSON.stringify(EXPORT_V1.employees));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.employees[0].name).toBe("T. Phi");
    expect(result.meta).toBeUndefined();
  });

  it("rejects empty or invalid JSON", () => {
    expect(parseSalaryJson("").ok).toBe(false);
    expect(parseSalaryJson("{").ok).toBe(false);
    expect(parseSalaryJson('{"foo":1}').ok).toBe(false);
  });

  it("prefers summary.total_amount, else sums employees", () => {
    const withSummary = parseSalaryJson(JSON.stringify(EXPORT_V1));
    expect(withSummary.ok).toBe(true);
    if (withSummary.ok) {
      expect(salaryJsonTotalVnd(withSummary.employees, withSummary.meta)).toBe(12_000_000);
      expect(thousandsFromVnd(salaryJsonTotalVnd(withSummary.employees, withSummary.meta))).toBe("12000");
    }
    const bare = parseSalaryJson(JSON.stringify(EXPORT_V1.employees));
    expect(bare.ok).toBe(true);
    if (bare.ok) {
      expect(salaryJsonTotalVnd(bare.employees, bare.meta)).toBe(12_000_000);
    }
  });
});

describe("mapSalaryEmployee", () => {
  it("falls back to account when name is missing", () => {
    expect(mapSalaryEmployee({ account: "tphi", amount: 1 })).toMatchObject({ name: "tphi", account: "tphi" });
  });

  it("skips rows without amount", () => {
    expect(mapSalaryEmployee({ name: "Lan" })).toBeNull();
  });
});

describe("normalizeSubPaymentLines", () => {
  it("sorts by sort_index and keeps attrs", () => {
    expect(
      normalizeSubPaymentLines([
        { id: "b", name: "Lan", amount: 2, sort_index: 1, attrs: { account: "lan" } },
        { id: "a", name: "Phi", amount: 1, sort_index: 0, attrs: { account: "tphi" } },
      ]),
    ).toEqual([
      { id: "a", name: "Phi", amount: 1, attrs: { account: "tphi" } },
      { id: "b", name: "Lan", amount: 2, attrs: { account: "lan" } },
    ]);
  });
});

describe("salaryEmployeesToLineRows", () => {
  it("maps JSON employees onto nested line rows with salary attrs", () => {
    const result = parseSalaryJson(JSON.stringify(EXPORT_V1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(salaryEmployeesToLineRows(result.employees)).toEqual([
      { name: "T. Phi", amount: 5_000_000, sort_index: 0, attrs: { account: "tphi" } },
      {
        name: "Lan",
        amount: 4_000_000,
        sort_index: 1,
        attrs: { account: "lan", deposit: 500_000, transfer_amount: 3_500_000 },
      },
      {
        name: "minh",
        amount: 3_000_000,
        sort_index: 2,
        attrs: { account: "minh", deposit: 200_000, transfer_amount: 2_800_000 },
      },
    ]);
  });
});

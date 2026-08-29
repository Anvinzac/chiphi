import { describe, expect, it } from "vitest";
import { extractJsonText } from "./receiptVision";
import { parseSalaryJson, salaryJsonTotalVnd } from "./salaryEmployees";

describe("extractJsonText", () => {
  it("unwraps fenced JSON and keeps schema v1", () => {
    const raw = [
      "Here you go",
      "```json",
      '{"employees":[{"name":"Rau","amount":25000}],"summary":{"total_amount":25000,"employee_count":1}}',
      "```",
    ].join("\n");
    const text = extractJsonText(raw);
    const result = parseSalaryJson(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.employees).toEqual([{ name: "Rau", amount: 25_000 }]);
    expect(salaryJsonTotalVnd(result.employees, result.meta)).toBe(25_000);
  });

  it("accepts a bare employees array from the model", () => {
    const text = extractJsonText('prefix [{"name":"Cà","amount":12000}] trailing');
    const result = parseSalaryJson(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.employees[0]).toEqual({ name: "Cà", amount: 12_000 });
  });

  it("throws when there is no JSON", () => {
    expect(() => extractJsonText("không đọc được")).toThrow("Model không trả JSON");
  });
});

import { describe, expect, it } from "vitest";
import {
  draftHasAmount,
  displayQtyToStored,
  formatOrderQty,
  kgToLang,
  storedQtyToDisplay,
  usesLangDisplay,
} from "./formatOrderQty";

describe("usesLangDisplay", () => {
  it("uses lạng for kg under 0.5", () => {
    expect(usesLangDisplay(0.3, "kg")).toBe(true);
    expect(usesLangDisplay(0.49, "kg")).toBe(true);
  });

  it("keeps kg at 0.5 and above", () => {
    expect(usesLangDisplay(0.5, "kg")).toBe(false);
    expect(usesLangDisplay(2, "kg")).toBe(false);
  });

  it("ignores non-kg units", () => {
    expect(usesLangDisplay(0.2, "gói")).toBe(false);
    expect(usesLangDisplay(0.2, "lạng")).toBe(false);
  });
});

describe("formatOrderQty", () => {
  it("shows 0.3 kg as 3 lạng (1 lạng = 100 g)", () => {
    expect(formatOrderQty(0.3, "kg")).toEqual({ value: "3", unit: "lạng" });
    expect(kgToLang(0.3)).toBe(3);
  });

  it("shows 0.25 kg as 2.5 lạng", () => {
    expect(formatOrderQty(0.25, "kg")).toEqual({ value: "2.5", unit: "lạng" });
  });

  it("keeps 0.5 kg as kg", () => {
    expect(formatOrderQty(0.5, "kg")).toEqual({ value: "0.5", unit: "kg" });
  });

  it("formats a partial with the ordered unit", () => {
    expect(formatOrderQty(0.2, "kg", 0.3)).toEqual({ value: "2", unit: "lạng" });
    expect(formatOrderQty(0.2, "kg", 2)).toEqual({ value: "0.2", unit: "kg" });
  });

  it("round-trips lạng display back to kg", () => {
    expect(storedQtyToDisplay(0.3, "kg", 0.3)).toBe(3);
    expect(displayQtyToStored(3, "kg", 0.3)).toBe(0.3);
  });
});

describe("draftHasAmount", () => {
  it("accepts a money line typed in thousands of ₫", () => {
    expect(draftHasAmount({ name: "Tôm", quantity: "", order_mode: "money", money_amount: "10" })).toBe(true);
    expect(draftHasAmount({ name: "Tôm", quantity: "1", order_mode: "money", money_amount: "" })).toBe(false);
  });

  it("accepts a measure line with quantity", () => {
    expect(draftHasAmount({ name: "Gạo", quantity: "2", order_mode: "measure" })).toBe(true);
    expect(draftHasAmount({ name: "Gạo", quantity: "0" })).toBe(false);
  });
});

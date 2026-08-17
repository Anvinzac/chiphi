import { describe, expect, it } from "vitest";
import { isSeedCategoryName } from "./seedData";

describe("isSeedCategoryName", () => {
  it("matches the English sandbox catalog, including truncated labels", () => {
    expect(isSeedCategoryName("Food & Ingredients")).toBe(true);
    expect(isSeedCategoryName("Food & Ingredient:")).toBe(true);
    expect(isSeedCategoryName("Beverages")).toBe(true);
    expect(isSeedCategoryName("Kitchen Supplies")).toBe(true);
    expect(isSeedCategoryName("Operations")).toBe(true);
    expect(isSeedCategoryName("Đi chợ")).toBe(false);
    expect(isSeedCategoryName("Khác")).toBe(false);
  });
});

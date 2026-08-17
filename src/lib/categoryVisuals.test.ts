import { describe, expect, it } from "vitest";
import { foldCategoryName, getCategoryVisual } from "./categoryVisuals";

describe("getCategoryVisual", () => {
  it("matches names with or without diacritics", () => {
    expect(foldCategoryName("Gia vị")).toBe(foldCategoryName("Gia vi"));
    expect(getCategoryVisual("Gia vi").name).toBe("Gia vị");
    expect(getCategoryVisual("Mang ve").name).toBe("Mang về");
    expect(getCategoryVisual("Da").emoji).toBe("🥓");
  });
});

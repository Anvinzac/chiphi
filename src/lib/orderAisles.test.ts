import { describe, expect, it } from "vitest";
import { aisleMeta, aisleWalkIndex, searchAisleMeta } from "./orderAisles";

describe("aisleMeta", () => {
  it("maps pantry slugs to Vietnamese stall names", () => {
    expect(aisleMeta("leafy-greens").title).toBe("Lá");
    expect(aisleMeta("root-vegetables").emoji).toBe("🥕");
    expect(aisleMeta(null).title).toBe("Khác");
  });

  it("walks the market in produce order", () => {
    expect(aisleWalkIndex("root-vegetables")).toBeLessThan(aisleWalkIndex("leafy-greens"));
    expect(aisleWalkIndex("leafy-greens")).toBeLessThan(aisleWalkIndex("herbs"));
    expect(aisleWalkIndex("khac")).toBeGreaterThan(aisleWalkIndex("stems-shoots"));
  });

  it("keeps a dedicated search stall", () => {
    expect(searchAisleMeta().key).toBe("search");
  });
});

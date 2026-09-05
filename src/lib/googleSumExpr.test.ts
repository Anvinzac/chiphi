import { describe, expect, it } from "vitest";
import { googleSumExpr } from "./googleSumExpr";

describe("googleSumExpr", () => {
  it("emits spaced addition that cannot be read as a date", () => {
    const expr = googleSumExpr([{ amount: 10 }, { amount: 9 }, { amount: 8 }]);
    expect(expr).toBe("=10 + 9 + 8");
    expect(expr).not.toMatch(/\d-\d/);
  });

  it("keeps a leading deduction from looking like a year or date", () => {
    expect(googleSumExpr([{ amount: 2000, sign: -1 }, { amount: 12000 }])).toBe("=0 - 2000 + 12000");
  });

  it("skips zero amounts", () => {
    expect(googleSumExpr([{ amount: 20 }, { amount: 0 }, { amount: 18 }])).toBe("=20 + 18");
  });
});

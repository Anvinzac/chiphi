import { describe, expect, it } from "vitest";
import {
  isValidLocalDateKey,
  localDateKey,
  msUntilNextLocalMidnight,
  parseLocalDateKey,
  startOfLocalDay,
} from "./localDate";

describe("localDateKey", () => {
  it("uses the local calendar day, not UTC", () => {
    const d = new Date(2026, 8, 5, 1, 30, 0);
    expect(localDateKey(d)).toBe("2026-09-05");
  });
});

describe("parseLocalDateKey", () => {
  it("parses a date-only string as local midnight", () => {
    const d = parseLocalDateKey("2026-09-05");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(0);
  });

  it("rejects overflow dates", () => {
    expect(isValidLocalDateKey("2026-02-31")).toBe(false);
    expect(isValidLocalDateKey("2026-09-05")).toBe(true);
  });

  it("accepts a Date without throwing", () => {
    const d = parseLocalDateKey(new Date(2026, 8, 5, 23, 15));
    expect(localDateKey(d)).toBe("2026-09-05");
  });
});

describe("startOfLocalDay", () => {
  it("drops the clock time so range compares stay on calendar days", () => {
    const d = startOfLocalDay(new Date(2026, 8, 1, 23, 50));
    expect(localDateKey(d)).toBe("2026-09-01");
    expect(d.getHours()).toBe(0);
  });
});

describe("msUntilNextLocalMidnight", () => {
  it("is within the next local day", () => {
    const ms = msUntilNextLocalMidnight(new Date(2026, 8, 5, 22, 0, 0));
    expect(ms).toBe(2 * 60 * 60 * 1000);
  });
});

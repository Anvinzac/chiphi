import { describe, expect, it } from "vitest";
import { formatVndParts, thousandsInputMark } from "./thousandsSuffix";

describe("formatVndParts", () => {
  it("keeps the last three digits small in 000 mode", () => {
    expect(formatVndParts(450000, "000")).toEqual({ main: "450", small: ".000" });
    expect(formatVndParts(1250000, "000")).toEqual({ main: "1.250", small: ".000" });
  });

  it("shows k, nghìn, or nothing for round thousands", () => {
    expect(formatVndParts(450000, "k")).toEqual({ main: "450", small: "k" });
    expect(formatVndParts(450000, "nghin")).toEqual({ main: "450", small: " nghìn" });
    expect(formatVndParts(450000, "none")).toEqual({ main: "450", small: "" });
    expect(formatVndParts(1250000, "k")).toEqual({ main: "1.250", small: "k" });
  });

  it("falls back to full digits when the amount is not a round thousand", () => {
    expect(formatVndParts(450500, "k")).toEqual({ main: "450", small: ".500" });
  });
});

describe("thousandsInputMark", () => {
  it("matches the selected trailing-thousands style", () => {
    expect(thousandsInputMark("000")).toBe(".000");
    expect(thousandsInputMark("k")).toBe("k");
    expect(thousandsInputMark("nghin")).toBe(" nghìn");
    expect(thousandsInputMark("none")).toBe("");
  });
});

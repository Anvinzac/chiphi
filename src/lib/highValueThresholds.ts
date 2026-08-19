const STORAGE_KEY = "mise.high-value-thresholds";
export const HIGH_VALUE_THRESHOLDS_EVENT = "mise:high-value-thresholds";

export const DEFAULT_HIGH_VALUE_VND = 1_000_000;
export const DEFAULT_VERY_HIGH_VALUE_VND = 3_000_000;
export const MILLION = 1_000_000;

export type AmountHighlight = "none" | "high" | "veryHigh";

export type HighValueThresholds = {
  high: number;
  veryHigh: number;
};

function asPositive(n: unknown, fallback: number) {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getHighValueThresholds(): HighValueThresholds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { high: DEFAULT_HIGH_VALUE_VND, veryHigh: DEFAULT_VERY_HIGH_VALUE_VND };
    const parsed = JSON.parse(raw) as Partial<HighValueThresholds>;
    const high = asPositive(parsed.high, DEFAULT_HIGH_VALUE_VND);
    const veryHigh = Math.max(high, asPositive(parsed.veryHigh, DEFAULT_VERY_HIGH_VALUE_VND));
    return { high, veryHigh };
  } catch {
    return { high: DEFAULT_HIGH_VALUE_VND, veryHigh: DEFAULT_VERY_HIGH_VALUE_VND };
  }
}

export function setHighValueThresholds(next: HighValueThresholds) {
  const high = Math.max(MILLION / 10, Math.round(next.high));
  const veryHigh = Math.max(high, Math.round(next.veryHigh));
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ high, veryHigh }));
  window.dispatchEvent(new Event(HIGH_VALUE_THRESHOLDS_EVENT));
}

export function amountHighlight(amount: number, high: number, veryHigh: number): AmountHighlight {
  if (amount >= veryHigh) return "veryHigh";
  if (amount >= high) return "high";
  return "none";
}

export function amountHighlightWrapClass(highlight: AmountHighlight) {
  return highlight === "high" ? "border-b-2 border-destructive/70" : "";
}

export function amountHighlightLabelClass(highlight: AmountHighlight) {
  return highlight === "veryHigh" ? "font-semibold text-destructive" : "";
}

export function amountHighlightTitle(highlight: AmountHighlight) {
  if (highlight === "veryHigh") return "Giá trị rất cao";
  if (highlight === "high") return "Giá trị cao";
  return undefined;
}

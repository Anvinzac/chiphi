export const THOUSANDS_SUFFIX_MODES = ["000", "k", "nghin", "none"] as const;
export type ThousandsSuffixMode = (typeof THOUSANDS_SUFFIX_MODES)[number];

export const THOUSANDS_SUFFIX_OPTIONS: {
  id: ThousandsSuffixMode;
  label: string;
  sample: string;
}[] = [
  { id: "000", label: "000", sample: "450.000" },
  { id: "k", label: "k", sample: "450k" },
  { id: "nghin", label: "nghìn", sample: "450 nghìn" },
  { id: "none", label: "Ẩn", sample: "450" },
];

const STORAGE_KEY = "mise.thousands-suffix";
export const THOUSANDS_SUFFIX_EVENT = "mise:thousands-suffix";

export function isThousandsSuffixMode(value: string): value is ThousandsSuffixMode {
  return (THOUSANDS_SUFFIX_MODES as readonly string[]).includes(value);
}

export function getThousandsSuffix(): ThousandsSuffixMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isThousandsSuffixMode(raw)) return raw;
  } catch {
    /* private mode */
  }
  return "000";
}

export function setThousandsSuffix(mode: ThousandsSuffixMode) {
  localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new Event(THOUSANDS_SUFFIX_EVENT));
}

/** Mark attached to a thousands input (user types 450, this is the trailing thousands). */
export function thousandsInputMark(mode: ThousandsSuffixMode): string {
  if (mode === "000") return ".000";
  if (mode === "k") return "k";
  if (mode === "nghin") return " nghìn";
  return "";
}

export function thousandsCaption(mode: ThousandsSuffixMode): string {
  if (mode === "k") return "k ₫";
  if (mode === "nghin") return "nghìn ₫";
  if (mode === "none") return "₫";
  return "nghìn ₫";
}

export function formatVndParts(
  amount: number,
  mode: ThousandsSuffixMode,
  locale = "vi-VN",
): { main: string; small: string } {
  const splitFull = (value: number) => {
    const formatted = value.toLocaleString(locale);
    const lastDot = formatted.lastIndexOf(".");
    if (lastDot === -1) return { main: formatted, small: "" };
    return { main: formatted.slice(0, lastDot), small: `.${formatted.slice(lastDot + 1)}` };
  };

  if (mode === "000") return splitFull(amount);

  const remainder = Math.abs(amount) % 1000;
  if (remainder >= 0.5 && remainder <= 999.5) return splitFull(amount);

  const main = Math.round(amount / 1000).toLocaleString(locale);
  if (mode === "k") return { main, small: "k" };
  if (mode === "nghin") return { main, small: " nghìn" };
  return { main, small: "" };
}

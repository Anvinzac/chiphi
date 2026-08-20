import { thousandsFromVnd, vndFromThousands } from "@/lib/vndThousands";

/** 1 lạng = 100 g. kg below this threshold displays as lạng. */
export const GRAMS_PER_LANG = 100;
export const LANG_PER_KG = 10;
export const LANG_KG_THRESHOLD = 0.5;

export type OrderMode = "measure" | "money";

export function isMoneyOrder(row: { order_mode?: string | null }): boolean {
  return row.order_mode === "money";
}

export function isKgUnit(unit: string): boolean {
  return unit.trim().toLowerCase() === "kg";
}

export function usesLangDisplay(quantityKg: number, unit: string): boolean {
  return isKgUnit(unit) && quantityKg > 0 && quantityKg < LANG_KG_THRESHOLD;
}

export function kgToLang(kg: number): number {
  return Math.round(kg * LANG_PER_KG * 10) / 10;
}

export function formatQtyNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export type FormattedQty = { value: string; unit: string };

/** Convert a quantity for display. Pass `orderedQuantity` so partials stay in the same unit as the order. */
export function formatOrderQty(
  quantity: number,
  unit: string,
  orderedQuantity = quantity,
): FormattedQty {
  if (usesLangDisplay(orderedQuantity, unit)) {
    return { value: formatQtyNumber(kgToLang(quantity)), unit: "lạng" };
  }
  return { value: formatQtyNumber(quantity), unit: unit || "kg" };
}

/** Convert a displayed qty (lạng when under 0.5 kg) back to the stored kg value. */
export function displayQtyToStored(
  displayQty: number,
  unit: string,
  orderedQuantity: number,
): number {
  if (usesLangDisplay(orderedQuantity, unit)) return displayQty / LANG_PER_KG;
  return displayQty;
}

/** Convert a stored kg qty to the number shown in the vendor hold field. */
export function storedQtyToDisplay(
  storedQty: number,
  unit: string,
  orderedQuantity: number,
): number {
  if (usesLangDisplay(orderedQuantity, unit)) return kgToLang(storedQty);
  return storedQty;
}

export function draftHasAmount(row: {
  name: string;
  quantity: string;
  order_mode?: string;
  money_amount?: string;
}): boolean {
  if (!row.name.trim()) return false;
  if (row.order_mode === "money") return vndFromThousands(row.money_amount ?? "") > 0;
  return (Number(row.quantity) || 0) > 0;
}

export function draftMoneyVnd(row: { money_amount?: string }): number {
  return vndFromThousands(row.money_amount ?? "");
}

export function moneyAmountToDraft(vnd: number): string {
  return thousandsFromVnd(vnd);
}

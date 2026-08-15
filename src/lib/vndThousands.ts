/** Expense amounts are typed in thousands of ₫; the last three zeroes are attached in the UI. */

export function thousandsFromVnd(amount: number): string {
  if (!amount) return "";
  const k = amount / 1000;
  if (!Number.isFinite(k) || k <= 0) return "";
  return Number.isInteger(k) ? String(k) : String(Math.round(k * 1000) / 1000);
}

export function vndFromThousands(raw: string): number {
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : 0;
}

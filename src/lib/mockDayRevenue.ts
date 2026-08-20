/** Deterministic mock revenue (VND) for a calendar day — UI preview only. */
export function mockRevenueForDay(dateStr: string, expenseVnd: number): number {
  let hash = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    hash ^= dateStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unit = (hash >>> 0) % 1000;
  const factor = 0.62 + (unit / 999) * 1.28;
  const base = expenseVnd > 0 ? expenseVnd : 280_000 + (unit % 12) * 45_000;
  return Math.max(0, Math.round((base * factor) / 1000) * 1000);
}

export function dayProfit(revenue: number, expense: number) {
  return revenue - expense;
}

export function dayProfitPct(revenue: number, profit: number) {
  if (revenue <= 0) return null;
  return (profit / revenue) * 100;
}

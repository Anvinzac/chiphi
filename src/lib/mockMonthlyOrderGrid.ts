/** Mock data for the Monthly Order grid — each day has 0 or 1 number (no emoji). Deterministic per date. */

export interface MonthlyOrderLine {
  num: string;
}

const NUM_PRESETS = ["1", "2", "3", "4", "5", "6", "8", "10", "12", "15", "18", "20"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function seededPick<T>(seed: number, pool: T[]): T {
  return pool[((seed % pool.length) + pool.length) % pool.length];
}

export function linesForDate(dateStr: string): MonthlyOrderLine[] {
  const h = hashStr(dateStr + "|monthly-order-num-v2");
  // ~20% empty, 80% single number — one number per cell max
  const bucket = h % 100;
  if (bucket < 20) return [];
  const seed = h >>> 0;
  const num = seededPick(seed >>> 2, NUM_PRESETS);
  return [{ num }];
}

export function mockMonthlyOrderByDate(rangeStart: Date, rangeEnd: Date): Map<string, MonthlyOrderLine[]> {
  const map = new Map<string, MonthlyOrderLine[]>();
  const cur = new Date(rangeStart);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const key = [
      cur.getFullYear(),
      String(cur.getMonth() + 1).padStart(2, "0"),
      String(cur.getDate()).padStart(2, "0"),
    ].join("-");
    map.set(key, linesForDate(key));
    cur.setDate(cur.getDate() + 1);
  }
  return map;
}

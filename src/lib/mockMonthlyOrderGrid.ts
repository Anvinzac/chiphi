export interface MonthlyOrderLine {
  num: string;
}

/** Empty day map for the monthly grid — no mock quantities. */
export function emptyMonthlyOrderByDate(rangeStart: Date, rangeEnd: Date): Map<string, MonthlyOrderLine[]> {
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
    map.set(key, []);
    cur.setDate(cur.getDate() + 1);
  }
  return map;
}

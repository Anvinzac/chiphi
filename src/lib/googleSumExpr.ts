/** Plain integer expression for Google to evaluate, e.g. "12000+8000-2000". */
export function googleSumExpr(lines: { amount: number; sign?: 1 | -1 }[]): string {
  return lines
    .map((line, i) => {
      const n = Math.round(line.amount);
      const sign = line.sign ?? 1;
      if (i === 0) return sign < 0 ? `-${n}` : String(n);
      return `${sign < 0 ? "-" : "+"}${n}`;
    })
    .join("");
}

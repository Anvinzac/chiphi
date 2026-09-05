/**
 * Integer expression for Google's calculator.
 * Spaces + a leading `=` keep it from being parsed as a calendar date
 * (e.g. "10-9-8"), which can yield a negative or date result around midnight.
 */
export function googleSumExpr(lines: { amount: number; sign?: 1 | -1 }[]): string {
  const terms = lines.flatMap(line => {
    const n = Math.round(Math.abs(line.amount));
    if (!n) return [];
    const negative = (line.sign ?? 1) < 0 || line.amount < 0;
    return [{ n, negative }];
  });
  if (terms.length === 0) return "";
  const body = terms
    .map((t, i) => {
      if (i === 0) return t.negative ? `0 - ${t.n}` : String(t.n);
      return t.negative ? ` - ${t.n}` : ` + ${t.n}`;
    })
    .join("");
  return `=${body}`;
}

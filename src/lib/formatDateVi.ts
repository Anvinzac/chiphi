/** Vietnamese short day–month: "5 th 8", "3 th 9" (day + th + month number). */
export function formatDayMonth(date: Date): string {
  return `${date.getDate()} th ${date.getMonth() + 1}`;
}

/** Inclusive range label: "5 th 8 – 3 th 9". */
export function formatDayMonthRange(start: Date, end: Date): string {
  return `${formatDayMonth(start)} – ${formatDayMonth(end)}`;
}

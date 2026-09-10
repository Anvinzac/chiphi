import { addDays, differenceInCalendarDays, format } from "date-fns";

/** Accounting periods: … → Jul 3–Aug 4 → Aug 5–Sep 3 → … (30-day chunks). */
export const PERIOD_ZERO_START = new Date(2026, 7, 5); // Aug 5, 2026
export const PERIOD_ZERO_END = new Date(2026, 8, 3); // Sep 3, 2026
export const PERIOD_PREV_START = new Date(2026, 6, 3); // Jul 3, 2026
export const PERIOD_PREV_END = new Date(2026, 7, 4); // Aug 4, 2026
export const PERIOD_LENGTH_DAYS = 30;

export function getPeriodBounds(offset: number) {
  if (offset === 0) return { start: PERIOD_ZERO_START, end: PERIOD_ZERO_END };
  if (offset === -1) return { start: PERIOD_PREV_START, end: PERIOD_PREV_END };
  if (offset > 0) {
    const start = addDays(PERIOD_ZERO_END, 1 + (offset - 1) * PERIOD_LENGTH_DAYS);
    return { start, end: addDays(start, PERIOD_LENGTH_DAYS - 1) };
  }
  // offset < -1: step backward from Jul 3 in 30-day chunks
  const start = addDays(PERIOD_PREV_START, (offset + 1) * PERIOD_LENGTH_DAYS);
  return { start, end: addDays(start, PERIOD_LENGTH_DAYS - 1) };
}

export function getPeriodOffsetForDate(date: Date) {
  const key = format(date, "yyyy-MM-dd");
  if (key >= format(PERIOD_ZERO_START, "yyyy-MM-dd") && key <= format(PERIOD_ZERO_END, "yyyy-MM-dd")) {
    return 0;
  }
  if (key >= format(PERIOD_PREV_START, "yyyy-MM-dd") && key <= format(PERIOD_PREV_END, "yyyy-MM-dd")) {
    return -1;
  }
  if (key > format(PERIOD_ZERO_END, "yyyy-MM-dd")) {
    return 1 + Math.floor(differenceInCalendarDays(date, addDays(PERIOD_ZERO_END, 1)) / PERIOD_LENGTH_DAYS);
  }
  return -1 + Math.floor(differenceInCalendarDays(date, PERIOD_PREV_START) / PERIOD_LENGTH_DAYS);
}

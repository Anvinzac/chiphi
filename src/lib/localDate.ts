/** Calendar yyyy-MM-dd in the user's local timezone — never UTC via toISOString. */
export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function ymdFromUnknown(iso: string | Date | null | undefined): string {
  if (iso instanceof Date) return Number.isNaN(iso.getTime()) ? "" : localDateKey(iso);
  const raw = String(iso ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return localDateKey(parsed);
  }
  return "";
}

export function parseLocalDateKey(iso: string | Date | null | undefined): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymdFromUnknown(iso));
  if (!m) return new Date(NaN);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return new Date(NaN);
  }
  return date;
}

export function isValidLocalDateKey(iso: string | Date | null | undefined): boolean {
  return !Number.isNaN(parseLocalDateKey(iso).getTime());
}

export function msUntilNextLocalMidnight(from = new Date()): number {
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  return Math.max(0, next.getTime() - from.getTime());
}

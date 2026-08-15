function storageKey(userId: string) {
  return `chiphi:amount-defaults:${userId}`;
}

function normalizeExpenseName(name: string) {
  return name.toLowerCase().trim();
}

export function getAmountDefaults(userId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

export function getAmountDefault(userId: string, name: string): number | null {
  const value = getAmountDefaults(userId)[normalizeExpenseName(name)];
  return typeof value === "number" && value > 0 ? value : null;
}

export function setAmountDefault(userId: string, name: string, amount: number | null) {
  const key = normalizeExpenseName(name);
  if (!key) return;
  const map = getAmountDefaults(userId);
  if (amount == null || amount <= 0) delete map[key];
  else map[key] = amount;
  localStorage.setItem(storageKey(userId), JSON.stringify(map));
}


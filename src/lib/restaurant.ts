export const DEFAULT_RESTAURANT = "Quán Chay Lá";
const STORAGE_KEY = "mise.restaurants";
const CURRENT_KEY = "mise.current-restaurant";

export function getRestaurants(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(s => typeof s === "string" && s.trim())) {
        const list = parsed.map((s: string) => s.trim()).filter(Boolean);
        if (list.length > 0) return list;
      }
    }
  } catch {
    /* ignore */
  }
  return [DEFAULT_RESTAURANT];
}

export function setRestaurants(list: string[]) {
  const clean = Array.from(new Set(list.map(s => s.trim()).filter(Boolean)));
  if (clean.length === 0) clean.push(DEFAULT_RESTAURANT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  window.dispatchEvent(new Event("mise:restaurants"));
}

export function getCurrentRestaurant(): string {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (raw && typeof raw === "string" && raw.trim()) {
      const list = getRestaurants();
      if (list.includes(raw.trim())) return raw.trim();
    }
  } catch {
    /* ignore */
  }
  return getRestaurants()[0] || DEFAULT_RESTAURANT;
}

export function setCurrentRestaurant(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const list = getRestaurants();
  if (!list.includes(trimmed)) {
    setRestaurants([...list, trimmed]);
  }
  localStorage.setItem(CURRENT_KEY, trimmed);
  window.dispatchEvent(new Event("mise:current-restaurant"));
}

export function addRestaurant(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return getRestaurants();
  const list = getRestaurants();
  if (list.includes(trimmed)) return list;
  const next = [...list, trimmed];
  setRestaurants(next);
  setCurrentRestaurant(trimmed);
  return next;
}

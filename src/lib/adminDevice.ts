const STORAGE_KEY = "mise.admin-device-id";

/** SHA-256 of this owner's Mac / iPhone / iPad hardware IDs. Plain IDs never ship in the client. */
const ALLOWED_ADMIN_DEVICE_HASHES = new Set([
  "724f725ee628ab7df7a924503541d0664bb7515cdf261f8edeea61cc330ce690",
  "b70b01f6ae45f48281b82d55fa17ba9b9f65a1c8b3840d7e1a80306742e1da72",
  "fce373cae6da7ea425f31e9b1d65d6fd0e8d44a2d08ef7639c97be92303c0029",
]);

export const ADMIN_DEVICE_BLOCKED = "Thiết bị này không được phép đăng nhập admin.";

export function normalizeDeviceToken(raw: string): string {
  return raw.trim().toUpperCase();
}

export async function hashDeviceToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeDeviceToken(token));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function readAdminDeviceToken(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? normalizeDeviceToken(value) : null;
  } catch {
    return null;
  }
}

export function writeAdminDeviceToken(token: string) {
  localStorage.setItem(STORAGE_KEY, normalizeDeviceToken(token));
}

export async function isAllowedAdminDevice(): Promise<boolean> {
  const token = readAdminDeviceToken();
  if (!token) return false;
  return ALLOWED_ADMIN_DEVICE_HASHES.has(await hashDeviceToken(token));
}

export async function adoptAdminDeviceToken(raw: string): Promise<boolean> {
  const token = normalizeDeviceToken(raw);
  if (!token) return false;
  if (!ALLOWED_ADMIN_DEVICE_HASHES.has(await hashDeviceToken(token))) return false;
  writeAdminDeviceToken(token);
  return true;
}

export async function assertAllowedAdminDevice(): Promise<void> {
  if (await isAllowedAdminDevice()) return;
  throw new Error(ADMIN_DEVICE_BLOCKED);
}

/** Pulls `#mise_device=` / `?mise_device=` off the URL so the token is not left in history. */
export function takeEnrollTokenFromUrl(): string | null {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const fromHash = hashParams.get("mise_device");
  const fromQuery = url.searchParams.get("mise_device");
  const token = fromHash || fromQuery;
  if (!token) return null;

  url.searchParams.delete("mise_device");
  if (fromHash) {
    hashParams.delete("mise_device");
    const nextHash = hashParams.toString();
    url.hash = nextHash ? `#${nextHash}` : "";
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  return token;
}

export async function enrollAdminDeviceFromPage(): Promise<boolean> {
  const fromUrl = takeEnrollTokenFromUrl();
  if (fromUrl) return adoptAdminDeviceToken(fromUrl);

  const bootstrap = typeof __MISE_ADMIN_DEVICE_BOOTSTRAP__ === "string"
    ? __MISE_ADMIN_DEVICE_BOOTSTRAP__
    : "";
  if (import.meta.env.DEV && bootstrap) return adoptAdminDeviceToken(bootstrap);
  return isAllowedAdminDevice();
}

export function adminDeviceEnrollUrl(origin = window.location.origin): string | null {
  const token = readAdminDeviceToken();
  if (!token) return null;
  return `${origin}/auth#mise_device=${encodeURIComponent(token)}`;
}

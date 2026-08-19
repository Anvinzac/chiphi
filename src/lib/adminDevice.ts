import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "mise.admin-device-id";

/** Gate stays open through 18 Aug 2026 (Vietnam), then Quick Admin requires a saved device. */
export const ADMIN_DEVICE_OPEN_UNTIL = Date.parse("2026-08-19T00:00:00+07:00");

export const ADMIN_DEVICE_BLOCKED = "Thiết bị này không được phép đăng nhập admin.";

export function isAdminDeviceGateOpen(now = Date.now()): boolean {
  return now < ADMIN_DEVICE_OPEN_UNTIL;
}

function createDeviceId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (typeof c?.randomUUID === "function") {
    return c.randomUUID().toUpperCase();
  }
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toUpperCase();
}

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)?.trim();
    if (existing) return existing.toUpperCase();
    const id = createDeviceId();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return createDeviceId();
  }
}

async function touchAdminDevice(via: string): Promise<boolean> {
  const deviceId = getOrCreateDeviceId();
  const { data, error } = await supabase.rpc("touch_admin_device", {
    p_device_id: deviceId,
    p_enrolled_via: via,
    p_user_agent: typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 400),
  });
  if (error) {
    console.warn("touch_admin_device", error.message);
    return false;
  }
  return Boolean(data);
}

/** Record this browser while the gate is open (any visit to the app URL). */
export async function recordAdminDeviceVisit(): Promise<void> {
  getOrCreateDeviceId();
  if (!isAdminDeviceGateOpen()) return;
  await touchAdminDevice("visit");
}

/** After a successful admin username/password sign-in, keep this browser on the allowlist. */
export async function enrollAdminDeviceAfterPassword(): Promise<void> {
  await touchAdminDevice("password");
}

export async function enrollAdminDeviceAfterQuickLogin(): Promise<void> {
  await touchAdminDevice("quick_admin");
}

export async function isAllowedAdminDevice(): Promise<boolean> {
  if (isAdminDeviceGateOpen()) return true;
  const { data, error } = await supabase.rpc("is_enrolled_admin_device", {
    p_device_id: getOrCreateDeviceId(),
  });
  if (error) {
    console.warn("is_enrolled_admin_device", error.message);
    return false;
  }
  return Boolean(data);
}

export async function assertAllowedAdminDevice(): Promise<void> {
  if (await isAllowedAdminDevice()) return;
  throw new Error(ADMIN_DEVICE_BLOCKED);
}

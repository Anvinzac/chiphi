import { ADMIN_PASSWORD, ADMIN_USERNAME, LOCAL_ADMIN_LOGIN_VISIBLE } from "@/lib/adminCredentials";

const STORAGE_KEY = "mise.saved-admin-login";

export type SavedAdminLogin = {
  username: string;
  password: string;
};

/** Remember the built-in admin account on this browser for the next sign-in. Local Vite only. */
export function saveAdminLogin(
  login: SavedAdminLogin = { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
) {
  if (!LOCAL_ADMIN_LOGIN_VISIBLE) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(login));
  } catch {
    /* noop */
  }
}

export function readSavedAdminLogin(): SavedAdminLogin | null {
  if (!LOCAL_ADMIN_LOGIN_VISIBLE) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedAdminLogin>;
    if (!parsed.username || !parsed.password) return null;
    return { username: parsed.username, password: parsed.password };
  } catch {
    return null;
  }
}

import { ADMIN_PASSWORD, ADMIN_USERNAME } from "@/lib/adminCredentials";

const STORAGE_KEY = "mise.saved-admin-login";

export type SavedAdminLogin = {
  username: string;
  password: string;
};

/** Remember the built-in admin account on this browser for the next sign-in. */
export function saveAdminLogin(
  login: SavedAdminLogin = { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(login));
  } catch {
    /* noop */
  }
}

export function readSavedAdminLogin(): SavedAdminLogin | null {
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

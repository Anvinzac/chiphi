/**
 * Device-scoped auto-login preference.
 * Only the admin account may be restored automatically — demo/sandbox never are.
 */
const KEY = "mise.autoLogin";

interface SavedCredentials {
  email: string;
  password: string;
}

export function saveAutoLogin(creds: SavedCredentials) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ role: "admin", ...creds }));
  } catch {
    /* storage unavailable — auto-login simply stays off */
  }
}

export function getAutoLogin(): SavedCredentials | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.role !== "admin" || !parsed.email || !parsed.password) return null;
    return { email: parsed.email, password: parsed.password };
  } catch {
    return null;
  }
}

export function clearAutoLogin() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

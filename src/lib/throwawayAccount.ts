/** Demo and sandbox only — never mix their sample data into a real or admin account. */
export const DEMO_EMAIL = "demo@mise.local";
export const SANDBOX_EMAIL = "sandbox@mise.local";

export function isThrowawayAccount(email?: string | null): boolean {
  return email === DEMO_EMAIL || email === SANDBOX_EMAIL;
}

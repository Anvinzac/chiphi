import { createQuickSignIn } from "@/lib/quickAuth";
import { SANDBOX_EMAIL } from "@/lib/throwawayAccount";

/**
 * Throwaway account for free-form testing — keeps scratch data out of the
 * shared demo and admin accounts.
 */
const SANDBOX_PASSWORD = "MiseSandbox2024!";

export const signInAsSandbox = createQuickSignIn({
  email: SANDBOX_EMAIL,
  password: SANDBOX_PASSWORD,
  username: "sandbox",
});

export function isSandboxUser(email?: string | null): boolean {
  return email === SANDBOX_EMAIL;
}

import { createQuickSignIn } from "@/lib/quickAuth";

const DEMO_EMAIL = "demo@mise.local";
const DEMO_PASSWORD = "MiseDemo2024!";

/** Shared demo account (manual sign-in only — never auto-logged). */
export const signInAsDemo = createQuickSignIn({
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
  username: "demo",
});

export function isDemoUser(email?: string | null): boolean {
  return email === DEMO_EMAIL;
}

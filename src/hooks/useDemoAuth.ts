import { supabase } from "@/integrations/supabase/client";

const DEMO_EMAIL = "demo@mise.local";
const DEMO_PASSWORD = "MiseDemo2024!";

let demoLoginPromise: Promise<void> | null = null;

/**
 * Attempts to sign into the shared demo account.
 * If the account doesn't exist yet, creates it first.
 */
export async function signInAsDemo(): Promise<void> {
  if (demoLoginPromise) return demoLoginPromise;

  demoLoginPromise = (async () => {
    // Try sign in first
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (!signInErr) return;

    // If invalid credentials, try creating the demo account
    if (signInErr.message.includes("Invalid login credentials")) {
      const { error: signUpErr } = await supabase.auth.signUp({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        options: { data: { username: "demo" } },
      });
      if (signUpErr) {
        console.error("Failed to create demo account:", signUpErr.message);
        demoLoginPromise = null;
        return;
      }
      // Sign in after creating
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (error) {
        console.error("Failed to sign into new demo account:", error.message);
        demoLoginPromise = null;
      }
    } else {
      console.error("Demo sign-in failed:", signInErr.message);
      demoLoginPromise = null;
    }
  })();

  return demoLoginPromise;
}

export function isDemoUser(email?: string | null): boolean {
  return email === DEMO_EMAIL;
}

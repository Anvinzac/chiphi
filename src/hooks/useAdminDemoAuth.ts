import { supabase } from "@/integrations/supabase/client";

const ADMIN_EMAIL = "admin@mise.local";
const ADMIN_PASSWORD = "AdminDemo2024!";

let adminLoginPromise: Promise<void> | null = null;

export async function signInAsAdmin(): Promise<void> {
  if (adminLoginPromise) return adminLoginPromise;

  adminLoginPromise = (async () => {
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (!signInErr) {
      await ensureAdminRole();
      return;
    }

    if (signInErr.message.includes("Invalid login credentials")) {
      const { error: signUpErr } = await supabase.auth.signUp({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        options: { data: { username: "admin" } },
      });
      if (signUpErr) {
        console.error("Failed to create admin account:", signUpErr.message);
        adminLoginPromise = null;
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });
      if (error) {
        console.error("Failed to sign into new admin account:", error.message);
        adminLoginPromise = null;
        return;
      }
      await ensureAdminRole();
    } else {
      console.error("Admin sign-in failed:", signInErr.message);
      adminLoginPromise = null;
    }
  })();

  return adminLoginPromise;
}

async function ensureAdminRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: existing } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) {
    await supabase.from("user_roles").insert({
      user_id: user.id,
      app_role: "admin",
    });
  }
}

export function isAdminDemoUser(email?: string | null): boolean {
  return email === ADMIN_EMAIL;
}

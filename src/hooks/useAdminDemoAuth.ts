import { supabase } from "@/integrations/supabase/client";
import { createQuickSignIn } from "@/lib/quickAuth";
import { assertAllowedAdminDevice } from "@/lib/adminDevice";

const ADMIN_EMAIL = "admin@mise.local";
const ADMIN_PASSWORD = "AdminDemo2024!";

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
      role: "admin" as const,
    });
  }
}

export const signInAsAdmin = createQuickSignIn({
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
  username: "admin",
  beforeSignIn: assertAllowedAdminDevice,
  afterSignIn: ensureAdminRole,
});

export function isAdminDemoUser(email?: string | null): boolean {
  return email === ADMIN_EMAIL;
}

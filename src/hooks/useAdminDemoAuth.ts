import { supabase } from "@/integrations/supabase/client";
import { createQuickSignIn } from "@/lib/quickAuth";
import { assertAllowedAdminDevice, enrollAdminDeviceAfterQuickLogin } from "@/lib/adminDevice";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "@/lib/adminCredentials";
import { saveAdminLogin } from "@/lib/savedAdminLogin";

export { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME } from "@/lib/adminCredentials";

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

async function afterAdminSignIn() {
  await ensureAdminRole();
  await enrollAdminDeviceAfterQuickLogin();
  saveAdminLogin();
}

export const signInAsAdmin = createQuickSignIn({
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
  username: "admin",
  beforeSignIn: assertAllowedAdminDevice,
  afterSignIn: afterAdminSignIn,
});

export function isAdminDemoUser(email?: string | null): boolean {
  return email === ADMIN_EMAIL;
}

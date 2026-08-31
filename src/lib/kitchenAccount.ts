import { supabase } from "@/integrations/supabase/client";

/** Kitchen account (`bep`) — restricted to the Orders page, submits for admin approval. */
export const KITCHEN_EMAIL = "bep@mise.local";
export const KITCHEN_USERNAME = "bep";

export function isKitchenAccount(email?: string | null): boolean {
  return email === KITCHEN_EMAIL;
}

/**
 * The kitchen reads the admin's order catalog, so catalog queries must target the
 * admin's user_id. Every other account reads its own.
 */
export async function resolveCatalogOwnerId(userId: string, email?: string | null): Promise<string> {
  if (!isKitchenAccount(email)) return userId;

  const { data } = await supabase.rpc("admin_for_kitchen", { p_kitchen: userId });
  if (typeof data === "string" && data.length > 0) return data;

  return userId;
}

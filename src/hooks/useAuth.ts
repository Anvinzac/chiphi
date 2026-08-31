import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { purgeSeededSampleSpend, seedDataForUser } from "@/lib/seedData";
import { isThrowawayAccount } from "@/lib/throwawayAccount";
import { isKitchenAccount } from "@/lib/kitchenAccount";
import type { Session } from "@supabase/supabase-js";

const seedByUser = new Map<string, Promise<void>>();
const purgedRealUsers = new Set<string>();

function onSignedIn(userId: string, email?: string | null) {
  if (isThrowawayAccount(email)) {
    if (!seedByUser.has(userId)) {
      seedByUser.set(userId, seedDataForUser(userId).catch(() => {
        seedByUser.delete(userId);
      }));
    }
    return;
  }
  // Kitchen owns real (pending) orders, so it is never seeded or purge-scrubbed
  if (isKitchenAccount(email)) return;

  if (purgedRealUsers.has(userId)) return;
  purgedRealUsers.add(userId);
  void purgeSeededSampleSpend(userId)
    .then(removed => {
      if (removed > 0) window.dispatchEvent(new Event("mise:account-data"));
    })
    .catch(() => {
      purgedRealUsers.delete(userId);
    });
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (session?.user) onSignedIn(session.user.id, session.user.email);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) onSignedIn(session.user.id, session.user.email);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, loading, user: session?.user ?? null, signOut };
}

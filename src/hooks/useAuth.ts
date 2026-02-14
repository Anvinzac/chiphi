import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { seedDataForUser } from "@/lib/seedData";
import type { Session } from "@supabase/supabase-js";

let seedPromise: Promise<void> | null = null;

function ensureSeed(userId: string) {
  if (!seedPromise) {
    seedPromise = seedDataForUser(userId);
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (session?.user) ensureSeed(session.user.id);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) ensureSeed(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    seedPromise = null;
    await supabase.auth.signOut();
  };

  return { session, loading, user: session?.user ?? null, signOut };
}

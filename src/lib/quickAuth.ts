import { supabase } from "@/integrations/supabase/client";

interface QuickAccount {
  email: string;
  password: string;
  username: string;
  /** Runs after a successful sign-in, e.g. to grant a role. */
  afterSignIn?: () => Promise<void>;
  /** Runs before any network call. Throw to abort, e.g. unknown device. */
  beforeSignIn?: () => Promise<void>;
}

/**
 * Signs into a built-in account, creating it on first use.
 * Returns a shared promise so concurrent callers don't race.
 */
export function createQuickSignIn({ email, password, username, afterSignIn, beforeSignIn }: QuickAccount) {
  let pending: Promise<void> | null = null;

  return function signIn(): Promise<void> {
    if (pending) return pending;

    pending = (async () => {
      await beforeSignIn?.();
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

      if (!signInErr) {
        await afterSignIn?.();
        return;
      }

      if (!signInErr.message.includes("Invalid login credentials")) {
        throw signInErr;
      }

      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (signUpErr) throw signUpErr;

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      await afterSignIn?.();
    })();

    // A failed attempt shouldn't poison later retries
    pending.catch(() => {
      pending = null;
    });

    return pending;
  };
}

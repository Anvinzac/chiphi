import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { signInAsAdmin } from "@/hooks/useAdminDemoAuth";
import { ADMIN_CREDENTIALS } from "@/hooks/useAdminDemoAuth";
import { saveAutoLogin, clearAutoLogin } from "@/lib/autoLogin";
import { isDemoUser } from "@/hooks/useDemoAuth";
import { isSandboxUser, signInAsSandbox } from "@/hooks/useSandboxAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Auth() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Throwaway sessions shouldn't block signing in as someone else
  const isDemoSession = isDemoUser(session?.user?.email) || isSandboxUser(session?.user?.email);
  const arrivalHandled = useRef(false);

  useEffect(() => {
    if (loading) return;

    // Only the session we arrived with gets dropped — not one created here
    if (!arrivalHandled.current) {
      arrivalHandled.current = true;
      if (session && isDemoSession) {
        supabase.auth.signOut();
        return;
      }
    }

    if (session) navigate("/", { replace: true });
  }, [session, loading, navigate, isDemoSession]);

  if (loading) return null;
  if (session && arrivalHandled.current && !isDemoSession) return null;

  // Convert username to a synthetic email for Supabase auth
  const toEmail = (u: string) => `${u.toLowerCase().trim()}@mise.local`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setSubmitting(true);
    const email = toEmail(username);
    try {
      if (isLogin) {
        clearAutoLogin();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: username.trim() },
          },
        });
        if (error) throw error;
        toast.success("Account created!");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-display text-primary">Mìsè</h1>
          <p className="text-sm text-muted-foreground mt-1">Restaurant expense tracker</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="off"
            inputMode="text"
            name="mise_username"
            aria-label="Username"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={isLogin ? "current-password" : "new-password"}
            aria-label="Password"
          />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "..." : isLogin ? "Sign In" : "Sign Up"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs"
              onClick={async () => {
                setSubmitting(true);
                try {
                  await signInAsAdmin();
                  saveAutoLogin(ADMIN_CREDENTIALS);
                } catch (err: any) {
                  toast.error(err.message);
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              Quick Admin Login
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs"
              onClick={async () => {
                setSubmitting(true);
                try {
                  clearAutoLogin();
                  await signInAsSandbox();
                } catch (err: any) {
                  toast.error(err.message);
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              Sandbox Login
            </Button>
          </div>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary underline-offset-2 hover:underline font-medium">
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
}

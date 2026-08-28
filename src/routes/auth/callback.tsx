import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallbackPage });

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const finish = async () => {
      if (!supabase) {
        if (active) void navigate({ to: "/auth" });
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("Supabase auth callback:", error);
          if (active) void navigate({ to: "/auth" });
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (active) void navigate({ to: data.session ? "/" : "/auth" });
    };

    void finish();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        Confirmando sua conta...
      </div>
    </main>
  );
}

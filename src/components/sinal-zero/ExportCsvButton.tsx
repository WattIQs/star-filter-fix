import { LogIn, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export function ExportCsvButton() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!email) {
    return (
      <Button asChild variant="outline" size="sm" className="w-full gap-2 text-xs">
        <Link to="/auth">
          <LogIn className="h-4 w-4" />
          Entrar
        </Link>
      </Button>
    );
  }

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <div className="flex w-full min-w-0 items-center gap-1">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs">
        <User className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate" title={email}>{email}</span>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs" onClick={() => void handleLogout()}>
        <LogOut className="h-4 w-4" />
        Sair
      </Button>
    </div>
  );
}

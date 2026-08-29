import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({ component: AuthPage });

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void navigate({ to: "/" });
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return setError("Autenticação não está configurada neste ambiente.");
    setLoading(true);
    setError(null);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (!isValidEmail(normalizedEmail)) throw new Error("Digite um endereço de e-mail válido, como nome@dominio.com.");
      if (password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        void navigate({ to: "/" });
        return;
      }

      const redirectTo = `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      if (data.session) {
        void navigate({ to: "/" });
      } else {
        setMessage("Conta criada! Verifique sua caixa de entrada e o spam para confirmar seu e-mail.");
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Não foi possível concluir a autenticação.";
      const lower = raw.toLowerCase();
      setError(
        lower.includes("invalid login credentials") ? "E-mail ou senha incorretos." :
        lower.includes("user already registered") ? "Este e-mail já possui uma conta. Tente entrar." :
        lower.includes("email not confirmed") ? "Confirme seu e-mail antes de entrar." :
        lower.includes("rate limit") ? "O envio de e-mail atingiu o limite temporário. Aguarde e tente novamente." : raw,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/.14),transparent_45%)] animate-pulse" />
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-700">
        <div className="rounded-3xl border border-border/70 bg-card/95 p-7 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="h-6 w-6" /></div>
            <h1 className="text-2xl font-bold tracking-tight">{mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{mode === "login" ? "Entre para acessar seus leads e dados." : "Comece a organizar seus leads no Star Filter."}</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium">E-mail
              <div className="relative mt-1.5"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="h-11 w-full rounded-xl border border-border bg-background/70 pl-10 pr-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></div>
            </label>
            <label className="block text-sm font-medium">Senha
              <div className="relative mt-1.5"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" className="h-11 w-full rounded-xl border border-border bg-background/70 pl-10 pr-11 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">{showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button></div>
            </label>
            {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {message && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{message}</p>}
            <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-all hover:-translate-y-0.5 disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
          </form>
          <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setMessage(null); setPassword(""); }} className="mt-5 w-full py-2 text-sm text-muted-foreground hover:text-foreground">{mode === "login" ? "Ainda não tenho uma conta" : "Já tenho uma conta"}</button>
          <Link to="/" className="mt-2 block text-center text-sm text-muted-foreground hover:text-foreground hover:underline">Voltar ao Star Filter</Link>
        </div>
      </div>
    </main>
  );
}

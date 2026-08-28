import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError("Autenticação não está configurada neste ambiente.");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError("Digite um endereço de e-mail válido, como nome@dominio.com.");
      return;
    }
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
        : await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: { emailRedirectTo: window.location.origin + "/" },
          });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setMessage("Cadastro criado. Enviamos um link de confirmação para seu e-mail. Confirme-o para ativar a conta.");
      } else {
        void navigate({ to: "/" });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Não foi possível concluir a autenticação.";
      const friendly = raw.toLowerCase().includes("invalid login credentials")
        ? "E-mail ou senha incorretos."
        : raw.toLowerCase().includes("email not confirmed")
          ? "Confirme seu e-mail antes de entrar."
          : raw;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/.14),transparent_45%)] animate-pulse" />
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-700">
        <div className="rounded-3xl border border-border/70 bg-card/95 p-7 shadow-2xl shadow-black/10 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-black/15 sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm transition-all duration-500 hover:rotate-3 hover:scale-110">
              <LockKeyhole className="h-6 w-6 transition-transform duration-300" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight transition-all duration-300">{isLogin ? "Bem-vindo de volta" : "Crie sua conta"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{isLogin ? "Entre para acessar seus leads e dados." : "Comece a organizar seus leads no Star Filter."}</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium">E-mail
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-all duration-300" />
                <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="h-11 w-full rounded-xl border border-border bg-background/70 pl-10 pr-3 outline-none transition-all duration-300 placeholder:text-muted-foreground/60 focus:-translate-y-0.5 focus:border-primary focus:ring-4 focus:ring-primary/10" />
              </div>
            </label>

            <label className="block text-sm font-medium">Senha
              <div className="relative mt-1.5">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" className="h-11 w-full rounded-xl border border-border bg-background/70 pl-10 pr-11 outline-none transition-all duration-300 placeholder:text-muted-foreground/60 focus:-translate-y-0.5 focus:border-primary focus:ring-4 focus:ring-primary/10" />
                <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-90">
                  <span className="transition-all duration-300 hover:scale-110">{showPassword ? <Eye className="h-4 w-4 animate-in zoom-in-75 duration-200" /> : <EyeOff className="h-4 w-4 animate-in zoom-in-75 duration-200" />}</span>
                </button>
              </div>
            </label>

            {error && <p className="animate-in slide-in-from-top-2 fade-in rounded-xl bg-destructive/10 p-3 text-sm text-destructive duration-300">{error}</p>}
            {message && <p className="animate-in slide-in-from-top-2 fade-in rounded-xl bg-muted p-3 text-sm text-muted-foreground duration-300">{message}</p>}

            <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-xl active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <button type="button" onClick={() => { setMode(isLogin ? "signup" : "login"); setError(null); setMessage(null); setPassword(""); }} className="mt-5 w-full rounded-lg py-2 text-sm text-muted-foreground transition-all duration-300 hover:text-foreground hover:scale-[1.01]">{isLogin ? "Ainda não tenho uma conta" : "Já tenho uma conta"}</button>
          <Link to="/" className="mt-2 block text-center text-sm text-muted-foreground transition-all duration-300 hover:text-foreground hover:underline">Voltar ao Star Filter</Link>
        </div>
      </div>
    </main>
  );
}

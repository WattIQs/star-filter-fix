import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

async function sendVerification(accessToken: string) {
  const response = await fetch("/api/auth/send-verification", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível enviar o código.");
}

async function verifyCode(accessToken: string, code: string) {
  const response = await fetch("/api/auth/verify-email", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível confirmar o código.");
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "verify">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("email_verified")
        .eq("id", session.user.id)
        .maybeSingle();
      if (profile?.email_verified) {
        void navigate({ to: "/" });
      } else {
        setEmail(session.user.email ?? "");
        setMode("verify");
        setMessage("Sua conta ainda precisa ser confirmada. Confira seu e-mail.");
      }
    });
  }, [navigate]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError("Autenticação não está configurada neste ambiente.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "verify") {
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error("Sua sessão expirou. Entre novamente.");
        await verifyCode(data.session.access_token, verificationCode);
        setMessage("E-mail confirmado com sucesso!");
        setTimeout(() => void navigate({ to: "/" }), 500);
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        throw new Error("Digite um endereço de e-mail válido, como nome@dominio.com.");
      }
      if (password.length < 6) {
        throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      }

      if (mode === "login") {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (loginError) throw loginError;
        const { data: profile } = await supabase
          .from("profiles")
          .select("email_verified")
          .eq("id", data.user.id)
          .maybeSingle();
        if (!profile?.email_verified) {
          await sendVerification(data.session.access_token);
          setMode("verify");
          setMessage("Sua conta ainda não foi confirmada. Enviamos um novo código pelo Brevo.");
          return;
        }
        void navigate({ to: "/" });
        return;
      }

      const { data, error: signupError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { email_verified: false } },
      });
      if (signupError) throw signupError;
      if (!data.session) {
        throw new Error("O Supabase ainda está exigindo confirmação automática por e-mail. Desative 'Confirm email' no Auth do Supabase para usar exclusivamente o Brevo.");
      }
      await sendVerification(data.session.access_token);
      setMode("verify");
      setMessage("Conta criada! Enviamos um código de 6 dígitos pelo Brevo para confirmar seu e-mail.");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Não foi possível concluir a autenticação.";
      const lower = raw.toLowerCase();
      const friendly = lower.includes("invalid login credentials")
        ? "E-mail ou senha incorretos."
        : lower.includes("user already registered")
          ? "Este e-mail já possui uma conta. Tente entrar."
          : lower.includes("email not confirmed")
            ? "Confirme seu e-mail antes de entrar."
            : raw;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sua sessão expirou. Entre novamente.");
      await sendVerification(data.session.access_token);
      setMessage("Novo código enviado pelo Brevo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reenviar o código.");
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === "login";
  const isVerify = mode === "verify";

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/.14),transparent_45%)] animate-pulse" />
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-700">
        <div className="rounded-3xl border border-border/70 bg-card/95 p-7 shadow-2xl shadow-black/10 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-black/15 sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm transition-all duration-500 hover:rotate-3 hover:scale-110">
              {isVerify ? <ShieldCheck className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{isVerify ? "Confirme seu e-mail" : isLogin ? "Bem-vindo de volta" : "Crie sua conta"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{isVerify ? `Enviamos um código para ${email}.` : isLogin ? "Entre para acessar seus leads e dados." : "Comece a organizar seus leads no Star Filter."}</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {!isVerify && (
              <>
                <label className="block text-sm font-medium">E-mail
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="h-11 w-full rounded-xl border border-border bg-background/70 pl-10 pr-3 outline-none transition-all duration-300 placeholder:text-muted-foreground/60 focus:-translate-y-0.5 focus:border-primary focus:ring-4 focus:ring-primary/10" />
                  </div>
                </label>

                <label className="block text-sm font-medium">Senha
                  <div className="relative mt-1.5">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" className="h-11 w-full rounded-xl border border-border bg-background/70 pl-10 pr-11 outline-none transition-all duration-300 placeholder:text-muted-foreground/60 focus:-translate-y-0.5 focus:border-primary focus:ring-4 focus:ring-primary/10" />
                    <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-90">
                      {showPassword ? <Eye className="h-4 w-4 animate-in zoom-in-75 duration-200" /> : <EyeOff className="h-4 w-4 animate-in zoom-in-75 duration-200" />}
                    </button>
                  </div>
                </label>
              </>
            )}

            {isVerify && (
              <label className="block text-sm font-medium">Código de confirmação
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="mt-1.5 h-14 w-full rounded-xl border border-border bg-background/70 text-center text-2xl font-bold tracking-[0.5em] outline-none transition-all duration-300 focus:-translate-y-0.5 focus:border-primary focus:ring-4 focus:ring-primary/10" />
              </label>
            )}

            {error && <p className="animate-in slide-in-from-top-2 fade-in rounded-xl bg-destructive/10 p-3 text-sm text-destructive duration-300">{error}</p>}
            {message && <p className="animate-in slide-in-from-top-2 fade-in rounded-xl bg-muted p-3 text-sm text-muted-foreground duration-300">{message}</p>}

            <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-xl active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Aguarde..." : isVerify ? "Confirmar e-mail" : isLogin ? "Entrar" : "Criar conta"}
            </button>
          </form>

          {isVerify ? (
            <button type="button" disabled={loading} onClick={() => void resend()} className="mt-5 w-full rounded-lg py-2 text-sm text-muted-foreground transition-all duration-300 hover:text-foreground hover:scale-[1.01] disabled:opacity-50">Reenviar código</button>
          ) : (
            <button type="button" onClick={() => { setMode(isLogin ? "signup" : "login"); setError(null); setMessage(null); setPassword(""); }} className="mt-5 w-full rounded-lg py-2 text-sm text-muted-foreground transition-all duration-300 hover:text-foreground hover:scale-[1.01]">{isLogin ? "Ainda não tenho uma conta" : "Já tenho uma conta"}</button>
          )}
          <Link to="/" className="mt-2 block text-center text-sm text-muted-foreground transition-all duration-300 hover:text-foreground hover:underline">Voltar ao Star Filter</Link>
        </div>
      </div>
    </main>
  );
}

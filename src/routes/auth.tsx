import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, LockKeyhole, Mail, RefreshCw, Sparkles, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({ component: AuthPage });
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

type SignupStep = "credentials" | "name" | "verify";

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<SignupStep>("credentials");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void navigate({ to: "/" });
    });
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData.session) void navigate({ to: "/" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (step !== "verify" || resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step, resendIn]);

  const setOtpDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    setError(null);
    if (digit && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    setOtp(Array.from({ length: OTP_LENGTH }, (_, index) => pasted[index] ?? ""));
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus();
  };

  const submitCredentials = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null); setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) return setError("Digite um endereço de e-mail válido, como nome@dominio.com.");
    if (password.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");
    if (mode === "signup") {
      setStep("name");
      return;
    }
    void authenticateLogin(normalizedEmail);
  };

  const authenticateLogin = async (normalizedEmail: string) => {
    if (!supabase) return setError("Autenticação não está configurada neste ambiente.");
    setLoading(true); setError(null); setMessage(null);
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (loginError) throw loginError;
      void navigate({ to: "/" });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Não foi possível entrar.";
      const lower = raw.toLowerCase();
      setError(lower.includes("invalid login credentials") ? "E-mail ou senha incorretos." : lower.includes("email not confirmed") ? "Confirme seu e-mail antes de entrar." : lower.includes("rate limit") ? "O envio de e-mail atingiu o limite temporário. Aguarde e tente novamente." : raw);
    } finally { setLoading(false); }
  };

  const createAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return setError("Autenticação não está configurada neste ambiente.");
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = displayName.trim().slice(0, 60);
    if (!normalizedName) return setError("Digite como devemos te chamar.");
    setLoading(true); setError(null); setMessage(null);
    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { full_name: normalizedName, username: normalizedName },
        },
      });
      if (signupError) throw signupError;
      if (data.session) { void navigate({ to: "/" }); return; }
      setStep("verify"); setOtp(Array(OTP_LENGTH).fill("")); setResendIn(RESEND_SECONDS);
      setMessage(`Enviamos um código de 6 dígitos para ${normalizedEmail}.`);
      window.setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Não foi possível criar sua conta.";
      const lower = raw.toLowerCase();
      setError(lower.includes("user already registered") ? "Este e-mail já possui uma conta. Tente entrar." : lower.includes("rate limit") ? "O envio de e-mail atingiu o limite temporário. Aguarde e tente novamente." : raw);
    } finally { setLoading(false); }
  };

  const verifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return setError("Autenticação não está configurada neste ambiente.");
    const token = otp.join("");
    if (token.length !== OTP_LENGTH) return setError("Digite os 6 dígitos do código.");
    setLoading(true); setError(null); setMessage(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: "email" });
      if (verifyError) throw verifyError;
      if (!data.session) throw new Error("O código foi aceito, mas a sessão não pôde ser criada.");
      setVerified(true); window.setTimeout(() => void navigate({ to: "/" }), 900);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Código inválido ou expirado.";
      setError(/expired|invalid/i.test(raw) ? "Código inválido ou expirado. Confira o e-mail e tente novamente." : raw);
      setOtp(Array(OTP_LENGTH).fill("")); window.setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally { setLoading(false); }
  };

  const resendCode = async () => {
    if (!supabase || resendIn > 0 || resending) return;
    setResending(true); setError(null); setMessage(null);
    try {
      const { error: resendError } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { full_name: displayName.trim(), username: displayName.trim() } } });
      if (resendError) throw resendError;
      setOtp(Array(OTP_LENGTH).fill("")); setResendIn(RESEND_SECONDS); setMessage("Novo código enviado. Confira sua caixa de entrada e o spam.");
      window.setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Não foi possível reenviar o código.";
      setError(/rate limit/i.test(raw) ? "Aguarde um pouco antes de solicitar outro código." : raw);
    } finally { setResending(false); }
  };

  const switchMode = () => { setMode((current) => current === "login" ? "signup" : "login"); setStep("credentials"); setError(null); setMessage(null); setPassword(""); setDisplayName(""); setOtp(Array(OTP_LENGTH).fill("")); };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl animate-pulse" />
        <div className="auth-orbit absolute left-[8%] top-[18%] h-28 w-28 rounded-full border border-primary/10" />
        <div className="auth-orbit auth-orbit-delay absolute right-[9%] bottom-[16%] h-40 w-40 rounded-full border border-cyan/10" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(var(--color-grid)_1px,transparent_1px),linear-gradient(90deg,var(--color-grid)_1px,transparent_1px)] [background-size:56px_56px]" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground auth-reveal"><Sparkles className="h-3.5 w-3.5 text-primary" /> STAR FILTER</div>
        <div className="glass-panel rounded-[2rem] border border-border/70 p-7 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:p-8 auth-card-enter">
          {step === "credentials" && <>
            <div className="mb-7 text-center auth-reveal"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-lg shadow-primary/10 animate-glow-pulse">{mode === "login" ? <LockKeyhole className="h-7 w-7" /> : <Sparkles className="h-7 w-7" />}</div><h1 className="text-3xl font-bold tracking-tight">{mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{mode === "login" ? "Entre para acessar seus leads e dados." : "Comece a organizar seus leads no Star Filter."}</p></div>
            <form onSubmit={submitCredentials} className="space-y-4">
              <label className="block text-sm font-medium auth-reveal">E-mail<div className="relative mt-1.5"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="h-12 w-full rounded-xl border border-border bg-background/70 pl-10 pr-3 outline-none transition-all duration-300 focus:-translate-y-0.5 focus:border-primary focus:ring-4 focus:ring-primary/10" /></div></label>
              <label className="block text-sm font-medium auth-reveal">
                Senha
                <div className="group relative mt-1.5">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    minLength={6}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="h-12 w-full rounded-xl border border-border bg-background/70 pl-10 pr-11 outline-none transition-all duration-300 focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-all duration-300 hover:bg-muted active:scale-95"
                  >
                    {showPassword ? <Eye className="h-4 w-4 shrink-0" /> : <EyeOff className="h-4 w-4 shrink-0" />}
                  </button>
                </div>
              </label>
              {error && <p role="alert" className="auth-shake rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={loading} className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-4 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"><span className="absolute inset-0 -translate-x-full bg-white/15 transition-transform duration-700 group-hover:translate-x-full" />{loading ? <span className="app-spinner relative h-4 w-4 border-primary-foreground/25 border-t-primary-foreground border-r-primary-foreground/70" /> : <span className="relative">{mode === "login" ? "Entrar" : "Continuar"}</span>}</button>
            </form>
            <button type="button" onClick={switchMode} className="mt-5 w-full py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">{mode === "login" ? "Ainda não tenho uma conta" : "Já tenho uma conta"}</button>
            <Link to="/" className="mt-2 flex items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Star Filter</Link>
          </>}
          {step === "name" && <div className="auth-reveal">
            <button type="button" onClick={() => { setStep("credentials"); setError(null); }} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</button>
            <div className="mb-7 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-lg shadow-primary/10"><UserRound className="h-7 w-7" /></div><h1 className="text-3xl font-bold tracking-tight">Como devemos te chamar?</h1><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Esse nome aparecerá no seu perfil e será salvo com sua conta.</p></div>
            <form onSubmit={createAccount} className="space-y-4"><label className="block text-sm font-medium">Seu nome<div className="relative mt-1.5"><UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input autoFocus required maxLength={60} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Ex.: Julio" className="h-13 w-full rounded-xl border border-border bg-background/70 pl-10 pr-3 text-base outline-none transition-all duration-300 focus:-translate-y-0.5 focus:border-primary focus:ring-4 focus:ring-primary/10" /></div></label>{error && <p role="alert" className="auth-shake rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}<button type="submit" disabled={loading || !displayName.trim()} className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-4 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"><span className="absolute inset-0 -translate-x-full bg-white/15 transition-transform duration-700 group-hover:translate-x-full" />{loading ? <span className="app-spinner relative h-4 w-4 border-primary-foreground/25 border-t-primary-foreground" /> : <span className="relative">Criar minha conta</span>}</button></form>
          </div>}
          {step === "verify" && <div className="auth-reveal">
            {verified ? <div className="py-10 text-center auth-success-enter"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary shadow-lg shadow-primary/20"><Check className="h-10 w-10" strokeWidth={2.5} /></div><h1 className="text-2xl font-bold">E-mail verificado</h1><p className="mt-2 text-sm text-muted-foreground">Tudo certo. Entrando no Star Filter...</p></div> : <>
              <button type="button" onClick={() => { setStep("name"); setError(null); setMessage(null); }} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</button>
              <div className="mb-7 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><KeyRound className="h-7 w-7" /></div><h1 className="text-3xl font-bold tracking-tight">Verifique seu e-mail</h1><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Digite o código de 6 dígitos que enviamos para <span className="font-medium text-foreground">{email}</span>.</p></div>
              <form onSubmit={verifyCode}><div className="mb-6 flex justify-center gap-2 sm:gap-3" onPaste={handleOtpPaste}>{otp.map((digit, index) => <input key={index} ref={(element) => { otpRefs.current[index] = element; }} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} value={digit} onChange={(event) => setOtpDigit(index, event.target.value)} onKeyDown={(event) => handleOtpKeyDown(index, event)} aria-label={`Dígito ${index + 1}`} className="h-12 w-10 rounded-xl border border-border bg-background/70 text-center text-xl font-bold tabular-nums outline-none transition-all duration-200 focus:-translate-y-1 focus:border-primary focus:ring-4 focus:ring-primary/10 sm:h-14 sm:w-12" />)}</div>{error && <p role="alert" className="auth-shake mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}{message && <p className="mb-4 rounded-xl border border-primary/15 bg-primary/5 p-3 text-center text-sm text-muted-foreground">{message}</p>}<button type="submit" disabled={loading || otp.join("").length !== OTP_LENGTH} className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-4 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"><span className="absolute inset-0 -translate-x-full bg-white/15 transition-transform duration-700 group-hover:translate-x-full" />{loading ? <span className="app-spinner relative h-4 w-4 border-primary-foreground/25 border-t-primary-foreground border-r-primary-foreground/70" /> : <Check className="relative h-4 w-4" />}<span className="relative">{loading ? "Verificando..." : "Verificar código"}</span></button></form>
              <div className="mt-6 text-center"><p className="text-xs text-muted-foreground">Não recebeu?</p><button type="button" disabled={resendIn > 0 || resending} onClick={() => void resendCode()} className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{resending ? <span className="app-spinner h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />} {resending ? "Enviando..." : resendIn > 0 ? `Reenviar em ${resendIn}s` : "Reenviar código"}</button></div>
            </>}
          </div>}
        </div>
        <p className="mt-5 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">Secure authentication · Star Filter</p>
      </div>
    </main>
  );
}

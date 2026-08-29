import { useEffect, useMemo, useState } from "react";
import { Check, Copy, LogOut, Mail, UserRound, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

function avatarUrl(email: string, metadata: Record<string, unknown>) {
  const providerAvatar = typeof metadata.avatar_url === "string" ? metadata.avatar_url : typeof metadata.picture === "string" ? metadata.picture : null;
  if (providerAvatar) return providerAvatar;
  const hashPromise = async () => {
    const data = new TextEncoder().encode(email.trim().toLowerCase());
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  return { hashPromise };
}

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      const nextEmail = data.user.email ?? "";
      setEmail(nextEmail);
      const metadata = data.user.user_metadata ?? {};
      const direct = avatarUrl(nextEmail, metadata);
      if (typeof direct === "string") setAvatar(direct);
      else void direct.hashPromise().then((hash) => {
        if (active) setAvatar(`https://www.gravatar.com/avatar/${hash}?s=192&d=404`);
      });
    });
    return () => { active = false; };
  }, []);

  const initials = useMemo(() => {
    const value = email.split("@")[0]?.replace(/[^a-zA-Z0-9]+/g, " ").trim() || "SF";
    return value.split(" ").slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SF";
  }, [email]);

  const copyEmail = async () => {
    if (!email) return;
    await navigator.clipboard?.writeText(email);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <div className="fixed right-3 top-3 z-[6000]">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Abrir perfil" className="group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-card/95 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:scale-105 hover:border-primary/50 hover:shadow-primary/15">
        {avatar ? <img src={avatar} alt="Foto de perfil" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" onError={() => setAvatar(null)} /> : <span className="text-xs font-bold text-primary">{initials}</span>}
        <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-primary/0 transition-all duration-300 group-hover:ring-primary/30" />
      </button>
      {open && (
        <div className="profile-menu-enter mt-2 w-[min(92vw,340px)] origin-top-right rounded-2xl border border-border/80 bg-card/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/20 bg-primary/10 text-primary">
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Perfil</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{email || "Usuário"}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Fechar perfil"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 grid gap-1">
            <button type="button" onClick={() => void copyEmail()} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-[.99]"><Mail className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{email || "E-mail"}</span>{copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</button>
            <button type="button" onClick={() => void signOut()} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-destructive transition-all hover:bg-destructive/10 active:scale-[.99]"><LogOut className="h-4 w-4" />Sair da conta</button>
          </div>
        </div>
      )}
    </div>
  );
}

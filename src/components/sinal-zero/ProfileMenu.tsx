import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, LogOut, Mail, Pencil, RefreshCw, Save, ShieldCheck, UserRound, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

async function buildGravatarUrl(email: string) {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `https://www.gravatar.com/avatar/${hex}?s=192&d=404`;
}

function getProviderAvatar(metadata: Record<string, unknown>) {
  return typeof metadata.avatar_url === "string" ? metadata.avatar_url : typeof metadata.picture === "string" ? metadata.picture : null;
}

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [refreshingAvatar, setRefreshingAvatar] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadProfile = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    const nextEmail = user.email ?? "";
    const metadata = user.user_metadata ?? {};
    setEmail(nextEmail);
    const nextName = typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : "";
    setDisplayName(nextName);
    setDraftName(nextName);
    const providerAvatar = getProviderAvatar(metadata);
    if (providerAvatar) {
      setAvatar(providerAvatar);
      return;
    }
    try {
      setAvatar(await buildGravatarUrl(nextEmail));
    } catch {
      setAvatar(null);
    }
  };

  useEffect(() => { void loadProfile(); }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initials = useMemo(() => {
    const source = displayName || email.split("@")[0] || "Star Filter";
    return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SF";
  }, [displayName, email]);

  const copyEmail = async () => {
    if (!email) return;
    try { await navigator.clipboard?.writeText(email); } finally { setCopied(true); window.setTimeout(() => setCopied(false), 1400); }
  };

  const saveName = async () => {
    if (!supabase) return;
    const nextName = draftName.trim().slice(0, 60);
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: nextName } });
    setSavingName(false);
    if (error) return;
    setDisplayName(nextName);
    setDraftName(nextName);
    setEditingName(false);
  };

  const refreshAvatar = async () => {
    setRefreshingAvatar(true);
    try { await loadProfile(); } finally { setRefreshingAvatar(false); }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <div ref={panelRef} className="fixed right-3 top-3 z-[6000]">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Abrir perfil" className="group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-card/95 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:scale-105 hover:border-primary/50 hover:shadow-primary/15">
        {avatar ? <img src={avatar} alt="Foto de perfil" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" onError={() => setAvatar(null)} /> : <span className="text-xs font-bold text-primary">{initials}</span>}
        <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-primary/0 transition-all duration-300 group-hover:ring-primary/30" />
      </button>
      {open && (
        <div className="profile-menu-enter mt-2 w-[min(92vw,360px)] origin-top-right overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="relative overflow-hidden border-b border-border/60 p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,color-mix(in_oklab,var(--color-primary)_13%,transparent),transparent_45%)]" />
            <div className="relative flex items-start gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-lg shadow-primary/10">
                {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" onError={() => setAvatar(null)} /> : <UserRound className="h-6 w-6" />}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-1.5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Seu perfil</p><ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" /></div>
                {editingName ? <div className="mt-2 flex items-center gap-1.5"><input autoFocus value={draftName} maxLength={60} onChange={(event) => setDraftName(event.target.value)} placeholder="Seu nome" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background/70 px-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /><button type="button" disabled={savingName} onClick={() => void saveName()} className="rounded-lg bg-primary p-2 text-primary-foreground transition hover:-translate-y-px disabled:opacity-60" aria-label="Salvar nome">{savingName ? <span className="app-spinner h-3.5 w-3.5 border-primary-foreground/25 border-t-primary-foreground border-r-primary-foreground/70" /> : <Save className="h-4 w-4" />}</button></div> : <div className="mt-1 flex items-center gap-1.5"><p className="truncate text-base font-bold text-foreground">{displayName || "Usuário"}</p><button type="button" onClick={() => setEditingName(true)} className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Editar nome"><Pencil className="h-3.5 w-3.5" /></button></div>}
                <p className="mt-1 truncate text-xs text-muted-foreground">{email || "Carregando e-mail..."}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Fechar perfil"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="grid gap-1 p-2">
            <button type="button" onClick={() => void copyEmail()} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-[.99]"><Mail className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{email || "E-mail"}</span>{copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</button>
            <button type="button" disabled={refreshingAvatar} onClick={() => void refreshAvatar()} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-[.99] disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshingAvatar ? "animate-spin" : ""}`} />{refreshingAvatar ? "Atualizando foto..." : "Atualizar foto"}</button>
            <button type="button" onClick={() => void signOut()} className="mt-1 flex items-center gap-3 rounded-xl border border-destructive/10 px-3 py-2.5 text-left text-sm text-destructive transition-all hover:bg-destructive/10 active:scale-[.99]"><LogOut className="h-4 w-4" />Sair da conta</button>
          </div>
          <div className="border-t border-border/60 px-4 py-2.5 text-[10px] text-muted-foreground/70">Conta protegida pelo Supabase Auth</div>
        </div>
      )}
    </div>
  );
}

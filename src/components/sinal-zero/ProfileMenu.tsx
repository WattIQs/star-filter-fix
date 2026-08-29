import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, LogOut, Moon, Pencil, RefreshCw, Save, Sun, UserRound, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Theme = "dark" | "light";

async function buildGravatarUrl(email: string) {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `https://www.gravatar.com/avatar/${hex}?s=256&d=404`;
}

function getProviderAvatar(metadata: Record<string, unknown>) {
  return typeof metadata.avatar_url === "string" ? metadata.avatar_url : typeof metadata.picture === "string" ? metadata.picture : null;
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("star-filter-theme", theme);
}

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    const userEmail = user.email ?? "";
    const metadata = user.user_metadata ?? {};
    const nextName = typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : "";
    setDisplayName(nextName);
    setDraftName(nextName);
    const providerAvatar = getProviderAvatar(metadata);
    if (providerAvatar) {
      setAvatar(providerAvatar);
      return;
    }
    try { setAvatar(await buildGravatarUrl(userEmail)); } catch { setAvatar(null); }
  };

  useEffect(() => {
    void loadProfile();
    const stored = localStorage.getItem("star-filter-theme");
    const nextTheme: Theme = stored === "light" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

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
    const source = displayName || "Star Filter";
    return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SF";
  }, [displayName]);

  const saveName = async () => {
    if (!supabase) return;
    const nextName = draftName.trim().slice(0, 60);
    if (!nextName) return;
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: nextName } });
    setSavingName(false);
    if (error) return;
    setDisplayName(nextName);
    setDraftName(nextName);
    setEditingName(false);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!supabase || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    setUploadingAvatar(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/avatar.${extension}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (uploadError) return;
      const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${publicData.publicUrl}?v=${Date.now()}`;
      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      if (!updateError) setAvatar(publicUrl);
    } finally { setUploadingAvatar(false); }
  };

  const refreshAvatar = async () => {
    setUploadingAvatar(true);
    try { await loadProfile(); } finally { setUploadingAvatar(false); }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const setSelectedTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <div ref={panelRef} data-profile-menu className="fixed right-3 top-2.5 z-[6000] lg:right-4 lg:top-3">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Abrir perfil" data-profile-trigger className="group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-card/95 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:scale-105 hover:border-primary/50 hover:shadow-primary/15">
        {avatar ? <img src={avatar} alt="Foto de perfil" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" onError={() => setAvatar(null)} /> : <span className="text-xs font-bold text-primary">{initials}</span>}
        <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-primary/0 transition-all duration-300 group-hover:ring-primary/30" />
      </button>
      {open && (
        <div className="profile-menu-enter absolute right-0 top-12 w-[min(92vw,370px)] origin-top-right overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="relative overflow-hidden border-b border-border/60 p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,color-mix(in_oklab,var(--color-primary)_13%,transparent),transparent_45%)]" />
            <div className="relative flex items-start gap-3">
              <div className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-lg shadow-primary/10">
                {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" onError={() => setAvatar(null)} /> : <UserRound className="h-6 w-6" />}
                <button type="button" onClick={() => fileRef.current?.click()} className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-lg bg-black/55 px-2 py-1 text-[9px] font-semibold text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100" aria-label="Alterar foto">{uploadingAvatar ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />} Foto</button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleAvatarUpload(file); event.currentTarget.value = ""; }} />
              <div className="min-w-0 flex-1 pt-0.5">
                {editingName ? <div className="flex items-center gap-1.5"><input autoFocus value={draftName} maxLength={60} onChange={(event) => setDraftName(event.target.value)} placeholder="Seu nome" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background/70 px-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /><button type="button" disabled={savingName} onClick={() => void saveName()} className="rounded-lg bg-primary p-2 text-primary-foreground transition hover:-translate-y-px disabled:opacity-60" aria-label="Salvar nome">{savingName ? <span className="app-spinner h-3.5 w-3.5 border-primary-foreground/25 border-t-primary-foreground border-r-primary-foreground/70" /> : <Save className="h-4 w-4" />}</button></div> : <div className="flex items-center gap-1.5"><p className="truncate text-base font-bold text-foreground">{displayName || "Usuário"}</p><button type="button" onClick={() => setEditingName(true)} className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Editar nome"><Pencil className="h-3.5 w-3.5" /></button></div>}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Fechar perfil"><X className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="p-2">
            <div className="mt-1.5 rounded-xl border border-border/70 bg-background/35 p-2">
              <div className="flex items-center gap-3 px-2 py-2"><div className="rounded-lg bg-primary/10 p-2 text-primary">{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground">Aparência</p><p className="text-[10px] text-muted-foreground">Tema do Star Filter</p></div></div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg bg-muted/60 p-1"><button type="button" onClick={() => setSelectedTheme("light")} className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${theme === "light" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Sun className="h-3.5 w-3.5" />Claro</button><button type="button" onClick={() => setSelectedTheme("dark")} className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${theme === "dark" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Moon className="h-3.5 w-3.5" />Escuro</button></div>
            </div>
            <div className="mt-2 grid gap-1"><button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingAvatar} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-60"><ImagePlus className="h-4 w-4" />{uploadingAvatar ? "Atualizando foto..." : "Alterar foto de perfil"}</button><button type="button" disabled={uploadingAvatar} onClick={() => void refreshAvatar()} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${uploadingAvatar ? "animate-spin" : ""}`} />Atualizar dados</button></div>
          </div>
          <div className="border-t border-border/60 p-2"><button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-3 rounded-xl border border-destructive/10 px-3 py-2.5 text-left text-sm text-destructive transition-all hover:bg-destructive/10 active:scale-[.99]"><LogOut className="h-4 w-4" />Sair</button></div>
        </div>
      )}
    </div>
  );
}

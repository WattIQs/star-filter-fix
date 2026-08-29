import { useEffect, useMemo, useRef, useState } from "react";
import { LogOut, Moon, Pencil, Save, Settings, Sun, UserRound, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Theme = "dark" | "light";

const AVATAR_COLORS = ["#06b6d4", "#f59e0b", "#8b5cf6", "#10b981", "#f43f5e", "#3b82f6", "#14b8a6", "#f97316"];

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("star-filter-theme", theme);
}

function avatarColor(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const panelRef = useRef<HTMLDivElement>(null);

  const loadProfile = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    const metadata = user.user_metadata ?? {};
    const nextName = typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.username === "string" ? metadata.username : typeof metadata.name === "string" ? metadata.name : "";
    setDisplayName(nextName);
    setDraftName(nextName);
  };

  useEffect(() => {
    void loadProfile();
    const stored = localStorage.getItem("star-filter-theme");
    const nextTheme: Theme = stored === "light" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  useEffect(() => {
    if (!open && !settingsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (settingsOpen) {
        if (target.closest("[data-settings-modal]")) return;
        setSettingsOpen(false);
        setOpen(false);
        return;
      }
      if (!panelRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, settingsOpen]);

  const initial = useMemo(() => (displayName.trim()[0] ?? "U").toUpperCase(), [displayName]);
  const color = useMemo(() => avatarColor(displayName || "Usuário"), [displayName]);

  const saveName = async () => {
    if (!supabase) return;
    const nextName = draftName.trim().slice(0, 60);
    if (!nextName) return;
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: nextName, username: nextName } });
    setSavingName(false);
    if (error) return;
    setDisplayName(nextName);
    setDraftName(nextName);
    setEditingName(false);
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
    <>
      <style>{`@media (min-width: 1024px) { header.z-\\[3000\\] { padding-right: 4.25rem !important; display: grid !important; grid-template-columns: auto minmax(300px, 1fr) auto !important; align-items: center !important; column-gap: 0.75rem !important; } header.z-\\[3000\\] > div:nth-child(2) { width: auto !important; max-width: none !important; flex: none !important; min-width: 0 !important; } header.z-\\[3000\\] > div:nth-child(3) { min-width: 0 !important; width: auto !important; justify-self: stretch !important; } }`}</style>
      <div ref={panelRef} data-profile-menu className="fixed right-3 top-2 z-[9999] lg:right-3 lg:top-2">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Abrir perfil" data-profile-trigger className="group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border/80 shadow-lg backdrop-blur-xl transition-all duration-300 hover:scale-[1.03] hover:border-primary/50" style={{ backgroundColor: color }}>
          <span className="text-sm font-bold text-white drop-shadow-sm">{initial}</span>
          <span className="pointer-events-none absolute inset-0 rounded-full bg-white/0 transition-colors duration-300 group-hover:bg-white/10" />
        </button>
        {open && !settingsOpen && (
          <div className="profile-menu-enter absolute right-0 top-12 w-[min(92vw,330px)] origin-top-right overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-2xl">
            <div className="relative overflow-hidden border-b border-border/60 p-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,color-mix(in_oklab,var(--color-primary)_13%,transparent),transparent_45%)]" />
              <div className="relative flex items-center gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-lg" style={{ backgroundColor: color }}>{initial}</div><div className="min-w-0 flex-1"><p className="truncate text-base font-bold text-foreground">{displayName || "Usuário"}</p><p className="text-[11px] text-muted-foreground">Seu perfil</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Fechar perfil"><X className="h-4 w-4" /></button></div>
            </div>
            <div className="p-2"><button type="button" onClick={() => { setOpen(false); setSettingsOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground"><Settings className="h-4 w-4" />Configurações</button></div>
            <div className="border-t border-border/60 p-2"><button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-3 rounded-xl border border-destructive/10 px-3 py-2.5 text-left text-sm text-destructive transition-all hover:bg-destructive/10"><LogOut className="h-4 w-4" />Sair</button></div>
          </div>
        )}
      </div>
      {settingsOpen && (
        <div className="settings-modal-backdrop fixed inset-0 z-[10000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Configurações">
          <button type="button" className="absolute inset-0 cursor-default bg-slate-950/45 backdrop-blur-[3px]" aria-label="Fechar configurações" onClick={() => setSettingsOpen(false)} />
          <div data-settings-modal className="settings-modal-panel relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-border/80 bg-card/95 shadow-2xl shadow-black/40 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-border/60 px-6 py-5"><div><p className="text-lg font-bold text-foreground">Configurações</p><p className="mt-1 text-xs text-muted-foreground">Personalize seu Star Filter</p></div><button type="button" onClick={() => setSettingsOpen(false)} className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground" aria-label="Fechar configurações"><X className="h-5 w-5" /></button></div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <section className="rounded-2xl border border-border/70 bg-background/35 p-5"><div className="mb-3 flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" /><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Perfil</p></div>{editingName ? <div className="flex gap-2"><input autoFocus value={draftName} maxLength={60} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveName(); }} placeholder="Como devemos te chamar?" className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background/70 px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /><button type="button" disabled={savingName} onClick={() => void saveName()} className="rounded-xl bg-primary px-4 text-primary-foreground transition hover:brightness-105 disabled:opacity-60" aria-label="Salvar nome">{savingName ? <span className="app-spinner h-3.5 w-3.5 border-primary-foreground/25 border-t-primary-foreground" /> : <Save className="h-4 w-4" />}</button></div> : <div className="flex items-center justify-between gap-3"><div><p className="text-base font-semibold text-foreground">{displayName || "Usuário"}</p><p className="mt-1 text-[11px] text-muted-foreground">Nome exibido no seu perfil</p></div><button type="button" onClick={() => setEditingName(true)} className="rounded-xl p-2.5 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Alterar nome"><Pencil className="h-4 w-4" /></button></div>}</section>
              <section className="rounded-2xl border border-border/70 bg-background/35 p-5"><div className="mb-3 flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary">{theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}</div><div><p className="text-base font-semibold text-foreground">Aparência</p><p className="text-[11px] text-muted-foreground">Escolha o modo de visualização</p></div></div><div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/60 p-1.5"><button type="button" onClick={() => setSelectedTheme("light")} className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${theme === "light" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Sun className="h-4 w-4" />Claro</button><button type="button" onClick={() => setSelectedTheme("dark")} className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${theme === "dark" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Moon className="h-4 w-4" />Escuro</button></div></section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

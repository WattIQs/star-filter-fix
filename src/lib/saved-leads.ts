import type { Establishment, SavedLead } from "./types";
import { supabase } from "./supabase";

const STORAGE_KEY = "sinal-zero:saved-leads:v1";

function readLocal(): SavedLead[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedLead => Boolean(item && typeof item === "object" && "id" in item));
  } catch {
    return [];
  }
}

function writeLocal(leads: SavedLead[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  } catch {
    // Storage may be unavailable in private/restricted browser contexts.
  }
}

async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function persistLead(lead: SavedLead): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) return;

  const { error } = await supabase.from("saved_leads").upsert(
    {
      user_id: userId,
      lead_id: lead.id,
      lead_data: lead,
      saved_at: lead.savedAt,
    },
    { onConflict: "user_id,lead_id" },
  );

  if (error) console.error("Erro ao salvar lead no Supabase:", error);
}

async function deletePersistedLead(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) return;

  const { error } = await supabase
    .from("saved_leads")
    .delete()
    .eq("user_id", userId)
    .eq("lead_id", id);

  if (error) console.error("Erro ao remover lead do Supabase:", error);
}

export async function syncSavedLeads(): Promise<SavedLead[]> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) return readLocal();

  const { data, error } = await supabase
    .from("saved_leads")
    .select("lead_id, lead_data, saved_at")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar leads do Supabase:", error);
    return readLocal();
  }

  const leads = (data ?? [])
    .map((row) => {
      const lead = row.lead_data as unknown as Establishment;
      return { ...lead, savedAt: row.saved_at } as SavedLead;
    })
    .filter((lead) => Boolean(lead?.id));

  writeLocal(leads);
  return leads;
}

export function getSavedLeads(): SavedLead[] {
  return readLocal();
}

export function isLeadSaved(id: string): boolean {
  return readLocal().some((lead) => lead.id === id);
}

export function saveLead(lead: Establishment): SavedLead {
  const current = readLocal();
  const existing = current.find((item) => item.id === lead.id);
  if (existing) return existing;

  const saved: SavedLead = { ...lead, savedAt: new Date().toISOString() };
  writeLocal([saved, ...current]);
  void persistLead(saved);
  return saved;
}

export function removeLead(id: string): void {
  writeLocal(readLocal().filter((lead) => lead.id !== id));
  void deletePersistedLead(id);
}

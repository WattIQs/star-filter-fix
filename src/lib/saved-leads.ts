import type { Establishment, SavedLead } from "./types";

const STORAGE_KEY = "sinal-zero:saved-leads:v1";

function read(): SavedLead[] {
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

function write(leads: SavedLead[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  } catch {
    // Storage may be unavailable in private/restricted browser contexts.
  }
}

export function getSavedLeads(): SavedLead[] {
  return read();
}

export function isLeadSaved(id: string): boolean {
  return read().some((lead) => lead.id === id);
}

export function saveLead(lead: Establishment): SavedLead {
  const current = read();
  const existing = current.find((item) => item.id === lead.id);
  if (existing) return existing;
  const saved: SavedLead = { ...lead, savedAt: new Date().toISOString() };
  write([saved, ...current]);
  return saved;
}

export function removeLead(id: string): void {
  write(read().filter((lead) => lead.id !== id));
}

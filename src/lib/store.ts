import type { Establishment, SavedLead } from "./types";

const STORAGE_KEY = "sinal-zero-saved-leads";

function safeGetItem(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeSetItem(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

export function getSavedLeads(): SavedLead[] {
  const raw = safeGetItem();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SavedLead[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLead(lead: Establishment): SavedLead {
  const saved: SavedLead = { ...lead, savedAt: new Date().toISOString() };
  const existing = getSavedLeads();
  const filtered = existing.filter((l) => l.id !== saved.id);
  const next = [saved, ...filtered];
  safeSetItem(JSON.stringify(next));
  return saved;
}

export function removeLead(id: string): void {
  const existing = getSavedLeads();
  const next = existing.filter((l) => l.id !== id);
  safeSetItem(JSON.stringify(next));
}

export function isLeadSaved(id: string): boolean {
  return getSavedLeads().some((l) => l.id === id);
}

export function exportLeadsToCsv(): string {
  const leads = getSavedLeads();
  const headers = [
    "Nome",
    "Categoria",
    "Endereco",
    "Nivel",
    "Contatavel",
    "Telefone",
    "WhatsApp",
    "Instagram",
    "Site",
    "Email",
    "Culinaria",
    "Horario",
    "Google Maps",
    "Latitude",
    "Longitude",
    "Salvo em",
  ];

  const rows = leads.map((lead) => [
    lead.name,
    lead.category,
    lead.address,
    lead.level,
    lead.contactable ? "Sim" : "Nao",
    lead.contact?.phoneRaw ?? "",
    lead.contact?.whatsappUrl ?? "",
    lead.contact?.instagramUrl ?? "",
    lead.contact?.websiteUrl ?? "",
    lead.contact?.email ?? "",
    lead.details?.cuisine ?? "",
    lead.details?.openingHours ?? "",
    lead.googleMapsUrl ?? "",
    lead.lat,
    lead.lon,
    lead.savedAt,
  ]);


  const escape = (value: unknown) => {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

export function downloadLeadsCsv() {
  if (typeof window === "undefined") return;
  const csv = exportLeadsToCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sinal-zero-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

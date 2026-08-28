import type { SavedLead } from "./types";
import { getSavedLeads } from "./saved-leads";

export { getSavedLeads, isLeadSaved, removeLead, saveLead } from "./saved-leads";

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

import type { Establishment } from "./types";
import { fetchWithTimeout } from "./geo.server";

export type VerificationStatus = "verified" | "rejected" | "unverified";
export interface LeadVerification {
  status: VerificationStatus;
  score: number;
  reasons: string[];
  checked: boolean;
  foundDigitalPresence: boolean;
  contactConfidence: "high" | "medium" | "low";
}
type SearchItem = { link?: string; title?: string; snippet?: string };
function env(name: string): string | undefined { return typeof process !== "undefined" ? process.env[name]?.trim() || undefined : undefined; }
export function externalVerificationConfigured(): boolean { return Boolean(env("GOOGLE_SEARCH_API_KEY") && env("GOOGLE_SEARCH_CX")); }
function normalize(value: string): string { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
function tokens(value: string): string[] { return normalize(value).split(" ").filter((t) => t.length >= 3); }
function similarity(name: string, text: string): number { const source = normalize(text); const wanted = tokens(name); if (!wanted.length) return 0; return wanted.filter((token) => source.includes(token)).length / wanted.length; }
function isSocial(link: string): boolean { try { const host = new URL(link).hostname.toLowerCase().replace(/^www\./, ""); return ["instagram.com", "facebook.com", "tiktok.com", "youtube.com", "linkedin.com", "x.com", "twitter.com"].some((domain) => host === domain || host.endsWith(`.${domain}`)); } catch { return false; } }
function isDirectory(link: string): boolean { try { const host = new URL(link).hostname.toLowerCase().replace(/^www\./, ""); return ["tripadvisor.com", "yelp.com", "ifood.com.br", "rappi.com.br", "ubereats.com", "google.com", "google.com.br", "wikipedia.org", "wikidata.org", "openstreetmap.org"].some((domain) => host === domain || host.endsWith(`.${domain}`)); } catch { return true; } }
async function googleSearch(query: string): Promise<SearchItem[]> {
  const key = env("GOOGLE_SEARCH_API_KEY"); const cx = env("GOOGLE_SEARCH_CX"); if (!key || !cx) return [];
  const url = new URL("https://customsearch.googleapis.com/customsearch/v1"); url.searchParams.set("key", key); url.searchParams.set("cx", cx); url.searchParams.set("q", query); url.searchParams.set("num", "8"); url.searchParams.set("hl", "pt-BR"); url.searchParams.set("gl", "br");
  const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 6000); if (!response.ok) return [];
  const data = (await response.json()) as { items?: SearchItem[] }; return data.items ?? [];
}
export async function verifyLead(lead: Establishment): Promise<LeadVerification> {
  if (!externalVerificationConfigured()) return { status: "unverified", score: 50, reasons: ["Verificação externa não configurada."], checked: false, foundDigitalPresence: false, contactConfidence: lead.contact.whatsappValid ? "high" : lead.contact.phoneDigits ? "medium" : "low" };
  const location = [lead.details.neighbourhood, lead.details.city, lead.details.state].filter(Boolean).join(" ");
  const query = `"${lead.name.replace(/"/g, "")}" ${location} Instagram Facebook site`.trim();
  const items = await googleSearch(query);
  let score = 100; const reasons: string[] = []; let foundDigitalPresence = false;
  for (const item of items) {
    const link = item.link ?? ""; if (!link) continue; const evidence = `${item.title ?? ""} ${item.snippet ?? ""}`; const match = similarity(lead.name, evidence);
    if (isSocial(link) && match >= 0.5) { foundDigitalPresence = true; score -= 80; reasons.push(`Perfil social encontrado com correspondência de ${Math.round(match * 100)}%.`); break; }
    if (!isSocial(link) && !isDirectory(link) && match >= 0.65) { foundDigitalPresence = true; score -= 75; reasons.push("Possível site oficial encontrado com forte correspondência de nome."); break; }
  }
  const contactConfidence = lead.contact.whatsappValid ? "high" : lead.contact.phoneDigits ? "medium" : "low";
  if (contactConfidence === "medium") score -= 10; if (contactConfidence === "low") score -= 35;
  if (foundDigitalPresence) return { status: "rejected", score: Math.max(0, score), reasons, checked: true, foundDigitalPresence: true, contactConfidence };
  if (contactConfidence === "low") return { status: "rejected", score: Math.max(0, score), reasons: [...reasons, "Nenhum meio de contato acionável foi confirmado."], checked: true, foundDigitalPresence: false, contactConfidence };
  reasons.push("Nenhuma presença digital comercial correspondente encontrada na busca externa.");
  return { status: score >= 85 ? "verified" : "unverified", score: Math.max(0, Math.min(100, score)), reasons, checked: true, foundDigitalPresence: false, contactConfidence };
}
export async function verifyLeads(leads: Establishment[]): Promise<(Establishment & { verification: LeadVerification })[]> {
  const output: (Establishment & { verification: LeadVerification })[] = []; const concurrency = 4;
  for (let i = 0; i < leads.length; i += concurrency) { const batch = leads.slice(i, i + concurrency); const verified = await Promise.all(batch.map(async (lead) => ({ ...lead, verification: await verifyLead(lead) }))); output.push(...verified); }
  return output;
}

import type { Establishment } from "./types";
import { fetchWithTimeout } from "./geo.server";

export type VerificationStatus = "verified" | "rejected" | "unverified";

export interface LeadVerification {
  status: VerificationStatus;
  score: number;
  reasons: string[];
  checked: boolean;
  foundDigitalPresence: boolean;
  foundWebsite: boolean;
  contactConfidence: "high" | "medium" | "low";
}

type SearchItem = { link?: string; title?: string; snippet?: string };
type SearchResponse = { items: SearchItem[]; ok: boolean };

function env(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env[name]?.trim() || undefined : undefined;
}

export function externalVerificationConfigured(): boolean {
  return Boolean(env("GOOGLE_SEARCH_API_KEY") && env("GOOGLE_SEARCH_CX"));
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value: string): string[] {
  return normalize(value).split(" ").filter((token) => token.length >= 3);
}

function similarity(name: string, text: string): number {
  const source = normalize(text);
  const wanted = tokens(name);
  if (!wanted.length) return 0;
  return wanted.filter((token) => source.includes(token)).length / wanted.length;
}

function pathIdentity(link: string): string {
  try {
    const url = new URL(link);
    return `${url.hostname} ${url.pathname} ${url.search}`;
  } catch {
    return "";
  }
}

function isSocial(link: string): boolean {
  try {
    const host = new URL(link).hostname.toLowerCase().replace(/^www\./, "");
    return ["instagram.com", "facebook.com", "tiktok.com", "youtube.com", "linkedin.com", "x.com", "twitter.com"].some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

function isDirectory(link: string): boolean {
  try {
    const host = new URL(link).hostname.toLowerCase().replace(/^www\./, "");
    return [
      "tripadvisor.com", "yelp.com", "ifood.com.br", "rappi.com.br", "ubereats.com",
      "google.com", "google.com.br", "wikipedia.org", "wikidata.org", "openstreetmap.org",
    ].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return true;
  }
}

async function googleSearch(query: string): Promise<SearchResponse> {
  const key = env("GOOGLE_SEARCH_API_KEY");
  const cx = env("GOOGLE_SEARCH_CX");
  if (!key || !cx) return { items: [], ok: false };

  const url = new URL("https://customsearch.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "8");
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "br");

  try {
    const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 5000);
    if (!response.ok) return { items: [], ok: false };
    const data = (await response.json()) as { items?: SearchItem[] };
    return { items: data.items ?? [], ok: true };
  } catch {
    return { items: [], ok: false };
  }
}

async function searchLeadPresence(lead: Establishment): Promise<{ items: SearchItem[]; successfulQueries: number }> {
  const cleanName = lead.name.replace(/"/g, "").trim();
  const location = [lead.details.neighbourhood, lead.details.city, lead.details.state].filter(Boolean).join(" ");
  const address = [lead.details.street, lead.details.housenumber].filter(Boolean).join(" ");
  const phone = lead.contact.phoneDigits ?? "";

  const queries = [
    `"${cleanName}" "${location}" (site:instagram.com OR site:facebook.com OR site:tiktok.com OR site:youtube.com)`,
    `"${cleanName}" "${location}" "${address}" -site:instagram.com -site:facebook.com -site:tiktok.com -site:youtube.com -site:tripadvisor.com -site:yelp.com -site:ifood.com.br`,
    phone ? `"${phone}" "${cleanName}"` : `"${cleanName}" "${location}" "${address}" official`,
  ];

  const batches = await Promise.all(queries.map((query) => googleSearch(query)));
  return {
    items: batches.flatMap((batch) => batch.items),
    successfulQueries: batches.filter((batch) => batch.ok).length,
  };
}

function contactConfidence(lead: Establishment): "high" | "medium" | "low" {
  if (lead.contact.whatsappValid) return "high";
  if (lead.contact.phoneDigits) return "medium";
  return "low";
}

export async function verifyLead(lead: Establishment): Promise<LeadVerification> {
  const confidence = contactConfidence(lead);
  const base: LeadVerification = {
    status: "unverified",
    score: 0,
    reasons: ["Verificação externa não configurada."],
    checked: false,
    foundDigitalPresence: false,
    foundWebsite: false,
    contactConfidence: confidence,
  };

  if (!externalVerificationConfigured()) return base;

  const search = await searchLeadPresence(lead);
  if (search.successfulQueries < 2 || search.items.length === 0) {
    return {
      ...base,
      reasons: ["Não houve consultas externas suficientes para confirmar a presença digital deste negócio."],
    };
  }

  const reasons: string[] = [];
  let foundDigitalPresence = false;
  let foundWebsite = false;

  for (const item of search.items) {
    const link = item.link ?? "";
    if (!link) continue;
    const evidence = `${item.title ?? ""} ${item.snippet ?? ""}`;
    const urlEvidence = pathIdentity(link);
    const nameMatch = similarity(lead.name, evidence);
    const urlMatch = similarity(lead.name, urlEvidence);
    const locationText = [lead.details.neighbourhood, lead.details.city, lead.details.state].filter(Boolean).join(" ");
    const locationMatch = locationText ? similarity(locationText, evidence) : 0;
    const combinedMatch = Math.max(nameMatch, urlMatch, nameMatch * 0.7 + locationMatch * 0.3);

    if (isSocial(link) && combinedMatch >= 0.55) {
      foundDigitalPresence = true;
      reasons.push(`Presença social encontrada com correspondência de ${Math.round(combinedMatch * 100)}%.`);
      continue;
    }

    if (!isSocial(link) && !isDirectory(link) && combinedMatch >= 0.75) {
      foundDigitalPresence = true;
      foundWebsite = true;
      reasons.push(`Site oficial encontrado com correspondência de ${Math.round(combinedMatch * 100)}%.`);
    }
  }

  return {
    status: "verified",
    score: foundDigitalPresence ? 0 : 100,
    reasons: foundDigitalPresence ? reasons : ["Nenhum site ou presença digital comercial com correspondência forte foi encontrado nas consultas externas."],
    checked: true,
    foundDigitalPresence,
    foundWebsite,
    contactConfidence: confidence,
  };
}

export async function verifyLeads(leads: Establishment[]): Promise<(Establishment & { verification: LeadVerification })[]> {
  const output: (Establishment & { verification: LeadVerification })[] = [];
  const concurrency = 3;
  for (let i = 0; i < leads.length; i += concurrency) {
    const batch = leads.slice(i, i + concurrency);
    const verified = await Promise.all(batch.map(async (lead) => ({ ...lead, verification: await verifyLead(lead) })));
    output.push(...verified);
  }
  return output;
}

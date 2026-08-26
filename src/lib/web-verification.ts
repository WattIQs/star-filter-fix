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

function host(link: string): string {
  try {
    return new URL(link).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isSocial(link: string): boolean {
  const value = host(link);
  return ["instagram.com", "facebook.com", "tiktok.com", "youtube.com", "linkedin.com", "x.com", "twitter.com"].some(
    (domain) => value === domain || value.endsWith(`.${domain}`),
  );
}

function isDirectory(link: string): boolean {
  const value = host(link);
  return [
    "tripadvisor.com", "yelp.com", "ifood.com.br", "rappi.com.br", "ubereats.com",
    "google.com", "google.com.br", "maps.google.com", "wikipedia.org", "wikidata.org", "openstreetmap.org",
  ].some((domain) => value === domain || value.endsWith(`.${domain}`));
}

function isLikelyOwnWebsite(link: string): boolean {
  if (!link || isSocial(link) || isDirectory(link)) return false;
  const value = host(link);
  return Boolean(value && !value.endsWith(".gov.br") && !value.endsWith(".edu.br"));
}

async function googleSearch(query: string): Promise<SearchResponse> {
  const key = env("GOOGLE_SEARCH_API_KEY");
  const cx = env("GOOGLE_SEARCH_CX");
  if (!key || !cx) return { items: [], ok: false };

  const url = new URL("https://customsearch.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "6");
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "br");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 5000);
      if (response.ok) {
        const data = (await response.json()) as { items?: SearchItem[] };
        return { items: data.items ?? [], ok: true };
      }
      if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }
      return { items: [], ok: false };
    } catch {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }
      return { items: [], ok: false };
    }
  }
  return { items: [], ok: false };
}

async function searchLeadPresence(lead: Establishment): Promise<{ items: SearchItem[]; successfulQueries: number }> {
  const cleanName = lead.name.replace(/"/g, "").trim();
  const location = [lead.details.neighbourhood, lead.details.city, lead.details.state].filter(Boolean).join(" ");
  const address = [lead.details.street, lead.details.housenumber].filter(Boolean).join(" ");
  const phone = lead.contact.phoneDigits ?? "";

  const socialQuery = `"${cleanName}" "${location}" (site:instagram.com OR site:facebook.com OR site:tiktok.com OR site:youtube.com)`;
  const websiteQuery = `"${cleanName}" "${location}" "${address}" -site:instagram.com -site:facebook.com -site:tiktok.com -site:youtube.com -site:linkedin.com -site:x.com -site:tripadvisor.com -site:yelp.com -site:ifood.com.br -site:rappi.com.br -site:ubereats.com`;
  const identityQuery = phone
    ? `"${phone}" "${cleanName}"`
    : `"${cleanName}" "${location}" "${address}" official`;

  const firstItems: SearchItem[] = [];
  let successfulQueries = 0;

  const social = await googleSearch(socialQuery);
  if (social.ok) successfulQueries += 1;
  firstItems.push(...social.items);

  const website = await googleSearch(websiteQuery);
  if (website.ok) successfulQueries += 1;
  firstItems.push(...website.items);

  const strongWebsite = firstItems.some((item) => {
    const link = item.link ?? "";
    const evidence = `${item.title ?? ""} ${item.snippet ?? ""}`;
    const match = Math.max(similarity(lead.name, evidence), similarity(lead.name, pathIdentity(link)));
    return isLikelyOwnWebsite(link) && match >= 0.60;
  });

  if (strongWebsite || successfulQueries < 2) {
    return { items: firstItems, successfulQueries };
  }

  const identity = await googleSearch(identityQuery);
  if (identity.ok) successfulQueries += 1;
  return { items: [...firstItems, ...identity.items], successfulQueries };
}

function contactConfidence(lead: Establishment): "high" | "medium" | "low" {
  if (lead.contact.whatsappValid) return "high";
  if (lead.contact.phoneDigits) return "medium";
  return "low";
}

export async function verifyLead(lead: Establishment): Promise<LeadVerification> {
  const confidence = contactConfidence(lead);
  const empty: LeadVerification = {
    status: "unverified",
    score: 0,
    reasons: ["Verificação web indisponível: configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX no Render."],
    checked: false,
    foundDigitalPresence: false,
    foundWebsite: false,
    contactConfidence: confidence,
  };

  if (!externalVerificationConfigured()) return empty;

  const search = await searchLeadPresence(lead);
  if (search.successfulQueries < 1) {
    return {
      ...empty,
      reasons: ["A busca web não respondeu. O lead não foi classificado para evitar falso positivo."],
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

    if (isSocial(link) && combinedMatch >= 0.50) {
      foundDigitalPresence = true;
      reasons.push(`Presença social encontrada com correspondência de ${Math.round(combinedMatch * 100)}%.`);
      continue;
    }

    if (isLikelyOwnWebsite(link) && combinedMatch >= 0.60) {
      foundDigitalPresence = true;
      foundWebsite = true;
      reasons.push(`Possível site próprio encontrado com correspondência de ${Math.round(combinedMatch * 100)}%.`);
      break;
    }
  }

  if (foundWebsite) {
    return { status: "rejected", score: 0, reasons, checked: true, foundDigitalPresence: true, foundWebsite: true, contactConfidence: confidence };
  }

  if (foundDigitalPresence) {
    return { status: "verified", score: 100, reasons, checked: true, foundDigitalPresence: true, foundWebsite: false, contactConfidence: confidence };
  }

  reasons.push(search.items.length === 0
    ? "As consultas externas responderam sem resultados correspondentes para presença digital comercial."
    : "Nenhuma presença digital comercial com correspondência forte foi encontrada nas consultas externas.");

  return {
    status: "verified",
    score: 100,
    reasons,
    checked: true,
    foundDigitalPresence: false,
    foundWebsite: false,
    contactConfidence: confidence,
  };
}

export async function verifyLeads(
  leads: Establishment[],
): Promise<(Establishment & { verification: LeadVerification })[]> {
  const output: (Establishment & { verification: LeadVerification })[] = [];
  const concurrency = 2;
  for (let i = 0; i < leads.length; i += concurrency) {
    const batch = leads.slice(i, i + concurrency);
    const verified = await Promise.all(batch.map(async (lead) => ({ ...lead, verification: await verifyLead(lead) })));
    output.push(...verified);
  }
  return output;
}

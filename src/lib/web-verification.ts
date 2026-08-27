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

/**
 * Star Filter is intentionally 100% free to operate.
 * Do not add Google Places, Google Custom Search, SerpAPI, DataForSEO,
 * or any other paid search provider here.
 */
export function externalVerificationConfigured(): boolean {
  return true;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  const ignored = new Set([
    "ltda",
    "me",
    "epp",
    "eireli",
    "comercio",
    "empresa",
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
  ]);
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !ignored.has(token));
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
  return [
    "instagram.com",
    "facebook.com",
    "tiktok.com",
    "youtube.com",
    "linkedin.com",
    "x.com",
    "twitter.com",
  ].some((domain) => value === domain || value.endsWith(`.${domain}`));
}

function isDirectory(link: string): boolean {
  const value = host(link);
  return [
    "tripadvisor.com",
    "yelp.com",
    "ifood.com.br",
    "rappi.com.br",
    "ubereats.com",
    "google.com",
    "google.com.br",
    "maps.google.com",
    "wikipedia.org",
    "wikidata.org",
    "openstreetmap.org",
    "facebook.com",
  ].some((domain) => value === domain || value.endsWith(`.${domain}`));
}

function isLikelyOwnWebsite(link: string): boolean {
  if (!link || isSocial(link) || isDirectory(link)) return false;
  const value = host(link);
  return Boolean(value && !value.endsWith(".gov.br") && !value.endsWith(".edu.br"));
}

/**
 * Free web discovery using DuckDuckGo's public HTML search endpoint.
 * This is a best-effort second signal only; OSM/Overpass remains the
 * primary structured source. No API key or paid account is required.
 */
async function freeWebSearch(query: string): Promise<SearchResponse> {
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", query);
  url.searchParams.set("kl", "br-pt");

  try {
    const response = await fetchWithTimeout(
      url.toString(),
      {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Mozilla/5.0 (compatible; StarFilter/1.0; +https://github.com/WattIQs/star-filter-fix)",
        },
      },
      7000,
    );

    if (!response.ok) return { items: [], ok: false };
    const html = await response.text();
    const items: SearchItem[] = [];

    // DuckDuckGo result pages use result__a/result__snippet. Keep parsing
    // deliberately conservative so malformed search pages cannot create
    // false positives.
    const resultPattern = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = resultPattern.exec(html)) && items.length < 10) {
      const link = decodeHtml(match[1]);
      const title = stripHtml(match[2]);
      const snippet = stripHtml(match[3]);
      if (link && /^https?:\/\//i.test(link)) items.push({ link, title, snippet });
    }

    // Some DDG responses change the snippet markup. Fall back to result
    // anchors alone, but never treat a search-provider URL as evidence.
    if (!items.length) {
      const anchorPattern = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = anchorPattern.exec(html)) && items.length < 10) {
        const link = decodeHtml(match[1]);
        const title = stripHtml(match[2]);
        if (link && /^https?:\/\//i.test(link)) items.push({ link, title });
      }
    }

    return { items, ok: true };
  } catch {
    return { items: [], ok: false };
  }
}

function stripHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/");
}

async function searchLeadPresence(
  lead: Establishment,
): Promise<{ items: SearchItem[]; successfulQueries: number }> {
  const cleanName = lead.name.replace(/["']/g, " ").replace(/\s+/g, " ").trim();
  const location = [lead.details.neighbourhood, lead.details.city, lead.details.state]
    .filter(Boolean)
    .join(" ");
  const address = [lead.details.street, lead.details.housenumber].filter(Boolean).join(" ");
  const phone = lead.contact.phoneDigits ?? "";
  const email = lead.contact.email ?? "";
  const identity = [`"${cleanName}"`, location ? `"${location}"` : "", address ? `"${address}"` : ""]
    .filter(Boolean)
    .join(" ");

  const queries = [
    `${identity} Instagram`,
    `${identity} WhatsApp`,
    `${identity} site oficial`,
    phone ? `"${phone}" "${cleanName}"` : "",
    email ? `"${email}"` : "",
  ].filter(Boolean);

  const responses = await Promise.all(queries.map((query) => freeWebSearch(query)));
  return {
    items: responses.flatMap((response) => response.items),
    successfulQueries: responses.filter((response) => response.ok).length,
  };
}

function contactConfidence(lead: Establishment): "high" | "medium" | "low" {
  if (lead.contact.whatsappValid) return "high";
  if (lead.contact.instagramUrl) return "medium";
  return "low";
}

function evidenceScore(
  lead: Establishment,
  item: SearchItem,
): { identity: number; context: number } {
  const evidence = `${item.title ?? ""} ${item.snippet ?? ""}`;
  const urlEvidence = pathIdentity(item.link ?? "");
  const locationText = [lead.details.neighbourhood, lead.details.city, lead.details.state]
    .filter(Boolean)
    .join(" ");
  const normalizedEvidence = normalize(evidence);
  const identity = Math.max(
    similarity(lead.name, evidence),
    similarity(lead.name, urlEvidence),
  );
  const context = Math.max(
    locationText ? similarity(locationText, evidence) : 0,
    lead.contact.phoneDigits && normalizedEvidence.includes(normalize(lead.contact.phoneDigits)) ? 1 : 0,
    lead.contact.email && normalizedEvidence.includes(normalize(lead.contact.email)) ? 1 : 0,
  );
  return { identity, context };
}

export async function verifyLead(lead: Establishment): Promise<LeadVerification> {
  const confidence = contactConfidence(lead);
  const empty: LeadVerification = {
    status: "unverified",
    score: 0,
    reasons: ["Verificação web gratuita indisponível no momento."],
    checked: false,
    foundDigitalPresence: false,
    foundWebsite: false,
    contactConfidence: confidence,
  };

  const existingWebsite = Boolean(lead.signals.website || lead.contact.websiteUrl);
  const existingSocial = Boolean(lead.signals.instagram || lead.contact.instagramUrl);
  const search = await searchLeadPresence(lead);

  if (search.successfulQueries === 0) return empty;

  let foundWebsite = existingWebsite;
  let foundDigitalPresence = existingWebsite || existingSocial;
  const reasons: string[] = [];

  if (existingWebsite) reasons.push("O cadastro já informa um site próprio.");
  if (existingSocial) reasons.push("O cadastro já informa Instagram.");

  for (const item of search.items) {
    const link = item.link ?? "";
    if (!link || isDirectory(link)) continue;

    const { identity, context } = evidenceScore(lead, item);
    const identityStrong = identity >= 0.75 || (tokens(lead.name).length <= 2 && identity >= 1);
    const contextual = context >= 0.25;
    if (!identityStrong || !contextual) continue;

    if (isSocial(link)) {
      foundDigitalPresence = true;
      reasons.push("Rede social encontrada com correspondência forte de nome e localização.");
      continue;
    }

    if (isLikelyOwnWebsite(link)) {
      foundDigitalPresence = true;
      foundWebsite = true;
      reasons.push("Site próprio encontrado com correspondência forte de nome e localização.");
    }
  }

  if (foundWebsite) {
    return {
      status: "rejected",
      score: 0,
      reasons: [...new Set([...reasons, "O estabelecimento possui site próprio."])],
      checked: true,
      foundDigitalPresence: true,
      foundWebsite: true,
      contactConfidence: confidence,
    };
  }

  if (foundDigitalPresence) {
    return {
      status: "verified",
      score: 100,
      reasons: [...new Set([...reasons, "Foi encontrada presença digital do estabelecimento."])],
      checked: true,
      foundDigitalPresence: true,
      foundWebsite: false,
      contactConfidence: confidence,
    };
  }

  const noEvidenceReason =
    search.items.length === 0
      ? "Nenhuma presença digital correspondente foi encontrada nas fontes gratuitas consultadas."
      : "As fontes gratuitas não encontraram site ou rede social com identificação suficientemente forte.";

  return {
    status: "verified",
    score: 100,
    reasons: [...new Set([...reasons, noEvidenceReason])],
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
  const concurrency = 3;
  for (let i = 0; i < leads.length; i += concurrency) {
    const batch = leads.slice(i, i + concurrency);
    const verified = await Promise.all(
      batch.map(async (lead) => ({
        ...lead,
        verification: await verifyLead(lead),
      })),
    );
    output.push(...verified);
  }
  return output;
}

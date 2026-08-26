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
  const ignored = new Set(["ltda", "me", "epp", "eireli", "comercio", "comercio", "empresa", "de", "da", "do", "das", "dos", "e"]);
  return normalize(value).split(" ").filter((token) => token.length >= 3 && !ignored.has(token));
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
  return ["instagram.com", "facebook.com", "tiktok.com", "youtube.com", "linkedin.com", "x.com", "twitter.com"].some((domain) => value === domain || value.endsWith(`.${domain}`));
}

function isDirectory(link: string): boolean {
  const value = host(link);
  return ["tripadvisor.com", "yelp.com", "ifood.com.br", "rappi.com.br", "ubereats.com", "google.com", "google.com.br", "maps.google.com", "wikipedia.org", "wikidata.org", "openstreetmap.org"].some((domain) => value === domain || value.endsWith(`.${domain}`));
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
  const cleanName = lead.name.replace(/["']/g, " ").replace(/\s+/g, " ").trim();
  const location = [lead.details.neighbourhood, lead.details.city, lead.details.state].filter(Boolean).join(" ");
  const address = [lead.details.street, lead.details.housenumber].filter(Boolean).join(" ");
  const phone = lead.contact.phoneDigits ?? "";
  const email = lead.contact.email ?? "";

  const identity = [`"${cleanName}"`, location ? `"${location}"` : "", address ? `"${address}"` : ""].filter(Boolean).join(" ");
  const socialQuery = `${identity} (site:instagram.com OR site:facebook.com OR site:tiktok.com OR site:youtube.com OR site:linkedin.com)`;
  const websiteQuery = `${identity} -site:instagram.com -site:facebook.com -site:tiktok.com -site:youtube.com -site:linkedin.com -site:x.com -site:twitter.com -site:tripadvisor.com -site:yelp.com -site:ifood.com.br -site:rappi.com.br -site:ubereats.com`;
  const contactQuery = phone ? `"${phone}" "${cleanName}"` : email ? `"${email}"` : `"${cleanName}" "${location}"`;

  const [social, website, contact] = await Promise.all([googleSearch(socialQuery), googleSearch(websiteQuery), googleSearch(contactQuery)]);
  return {
    items: [...social.items, ...website.items, ...contact.items],
    successfulQueries: Number(social.ok) + Number(website.ok) + Number(contact.ok),
  };
}

function contactConfidence(lead: Establishment): "high" | "medium" | "low" {
  if (lead.contact.whatsappValid || lead.contact.email) return "high";
  if (lead.contact.phoneDigits || lead.contact.instagramUrl || lead.contact.facebookUrl) return "medium";
  return "low";
}

function evidenceScore(lead: Establishment, item: SearchItem): { identity: number; context: number } {
  const evidence = `${item.title ?? ""} ${item.snippet ?? ""}`;
  const urlEvidence = pathIdentity(item.link ?? "");
  const locationText = [lead.details.neighbourhood, lead.details.city, lead.details.state].filter(Boolean).join(" ");
  const identity = Math.max(similarity(lead.name, evidence), similarity(lead.name, urlEvidence));
  const context = Math.max(
    locationText ? similarity(locationText, evidence) : 0,
    lead.contact.phoneDigits && normalize(evidence).includes(normalize(lead.contact.phoneDigits)) ? 1 : 0,
    lead.contact.email && normalize(evidence).includes(normalize(lead.contact.email)) ? 1 : 0,
  );
  return { identity, context };
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

  const existingWebsite = Boolean(lead.signals.website || lead.contact.websiteUrl);
  const existingSocial = Boolean(lead.signals.instagram || lead.signals.facebook || lead.contact.instagramUrl || lead.contact.facebookUrl);
  const existingContact = Boolean(lead.contact.phoneDigits || lead.contact.email || lead.contact.whatsappValid);
  const search = await searchLeadPresence(lead);
  if (search.successfulQueries === 0) return { ...empty, reasons: ["A busca web não respondeu. O lead não foi classificado para evitar falso positivo."] };

  let foundWebsite = existingWebsite;
  let foundDigitalPresence = existingWebsite || existingSocial;
  const reasons: string[] = [];

  if (existingWebsite) reasons.push("O cadastro já informa um site próprio.");
  if (existingSocial) reasons.push("O cadastro já informa uma rede social.");

  for (const item of search.items) {
    const link = item.link ?? "";
    if (!link) continue;
    const { identity, context } = evidenceScore(lead, item);
    const identityStrong = identity >= 0.75 || (tokens(lead.name).length <= 2 && identity >= 1);
    const contextual = context >= 0.25;

    if (isSocial(link) && identityStrong && contextual) {
      foundDigitalPresence = true;
      reasons.push("Presença social encontrada com correspondência de nome e contexto.");
      continue;
    }
    if (isLikelyOwnWebsite(link) && identityStrong && contextual) {
      foundDigitalPresence = true;
      foundWebsite = true;
      reasons.push("Site próprio encontrado com correspondência de nome e contexto.");
      continue;
    }
  }

  if (foundWebsite) {
    return { status: "rejected", score: 0, reasons: [...new Set([...reasons, "O estabelecimento possui site próprio."])], checked: true, foundDigitalPresence: true, foundWebsite: true, contactConfidence: confidence };
  }
  if (foundDigitalPresence) {
    return { status: "verified", score: 100, reasons: [...new Set([...reasons, "Foi encontrada presença digital do estabelecimento."])], checked: true, foundDigitalPresence: true, foundWebsite: false, contactConfidence: confidence };
  }

  const noEvidenceReason = search.items.length === 0
    ? "Nenhuma presença digital correspondente foi encontrada nas consultas externas."
    : existingContact
      ? "As consultas externas não encontraram site ou rede social com identificação suficientemente forte; contatos existentes não contam como presença digital."
      : "As consultas externas não encontraram site ou rede social com identificação suficientemente forte.";
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

export async function verifyLeads(leads: Establishment[]): Promise<(Establishment & { verification: LeadVerification })[]> {
  const output: (Establishment & { verification: LeadVerification })[] = [];
  const concurrency = 5;
  for (let i = 0; i < leads.length; i += concurrency) {
    const batch = leads.slice(i, i + concurrency);
    const verified = await Promise.all(batch.map(async (lead) => ({ ...lead, verification: await verifyLead(lead) })));
    output.push(...verified);
  }
  return output;
}

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
  url.searchParams.set("num", "6");
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "br");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 3200);
      if (response.ok) {
        const data = (await response.json()) as { items?: SearchItem[] };
        return { items: data.items ?? [], ok: true };
      }
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }
      return { items: [], ok: false };
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 150));
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
  const websiteQuery = `"${cleanName}" "${location}" "${address}" -site:instagram.com -site:facebook.com -site:tiktok.com -site:youtube.com -site:tripadvisor.com -site:yelp.com -site:ifood.com.br -site:rappi.com.br`;
  const identityQuery = phone
    ? `"${phone}" "${cleanName}"`
    : `"${cleanName}" "${location}" "${address}" official`;

  const firstPass = await Promise.all([googleSearch(socialQuery), googleSearch(websiteQuery)]);
  const firstItems = firstPass.flatMap((batch) => batch.items);
  const firstSuccessful = firstPass.filter((batch) => batch.ok).length;

  const firstPassHasEvidence = firstItems.some((item) => {
    const link = item.link ?? "";
    if (!link) return false;
    const evidence = `${item.title ?? ""} ${item.snippet ?? ""}`;
    const urlEvidence = pathIdentity(link);
    const match = Math.max(similarity(lead.name, evidence), similarity(lead.name, urlEvidence));
    return (isSocial(link) && match >= 0.55) || (!isSocial(link) && !isDirectory(link) && match >= 0.75);
  });

  if (firstPassHasEvidence || firstSuccessful < 2) {
    return { items: firstItems, successfulQueries: firstSuccessful };
  }

  const identity = await googleSearch(identityQuery);
  return {
    items: [...firstItems, ...identity.items],
    successfulQueries: firstSuccessful + (identity.ok ? 1 : 0),
  };
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
  // Duas consultas bem-sucedidas são suficientes para concluir que não houve
  // evidência encontrada. Resultado vazio do CSE não significa erro: é um
  // resultado válido para uma busca de ausência.
  if (search.successfulQueries < 2) {
    return {
      ...empty,
      reasons: ["A busca web não respondeu com consultas suficientes para confirmar este negócio."],
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
      break;
    }

    if (!isSocial(link) && !isDirectory(link) && combinedMatch >= 0.75) {
      foundDigitalPresence = true;
      foundWebsite = true;
      reasons.push(`Possível site oficial encontrado com correspondência de ${Math.round(combinedMatch * 100)}%.`);
      break;
    }
  }

  if (foundDigitalPresence) {
    return { status: "rejected", score: 0, reasons, checked: true, foundDigitalPresence: true, foundWebsite, contactConfidence: confidence };
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
  const concurrency = 8;
  for (let i = 0; i < leads.length; i += concurrency) {
    const batch = leads.slice(i, i + concurrency);
    const verified = await Promise.all(batch.map(async (lead) => ({ ...lead, verification: await verifyLead(lead) })));
    output.push(...verified);
  }
  return output;
}

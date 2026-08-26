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
    ].some((domain) => host === domain || host.endsWith(`.${domain}`),
    );
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

  try {
    const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 3500);
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

  const socialQuery = `"${cleanName}" "${location}" (site:instagram.com OR site:facebook.com OR site:tiktok.com OR site:youtube.com)`;
  const websiteQuery = `"${cleanName}" "${location}" "${address}" -site:instagram.com -site:facebook.com -site:tiktok.com -site:youtube.com -site:tripadvisor.com -site:yelp.com -site:ifood.com.br -site:rappi.com.br`;
  const identityQuery = phone
    ? `"${phone}" "${cleanName}"`
    : `"${cleanName}" "${location}" "${address}" official`;

  // Primeira rodada: duas consultas independentes em paralelo. Na maioria dos
  // casos isso resolve a decisão sem gastar uma terceira chamada.
  const firstPass = await Promise.all([googleSearch(socialQuery), googleSearch(websiteQuery)]);
  const firstItems = firstPass.flatMap((batch) => batch.items);
  const firstSuccessful = firstPass.filter((batch) => batch.ok).length;

  // Se não apareceu nada forte, a terceira consulta ajuda a resolver nomes
  // parecidos/duplicados. Ela só roda quando realmente é necessária.
  const firstPassHasEvidence = firstItems.some((item) => {
    const link = item.link ?? "";
    if (!link) return false;
    const evidence = `${item.title ?? ""} ${item.snippet ?? ""}`;
    const urlEvidence = pathIdentity(link);
    const match = Math.max(similarity(lead.name, evidence), similarity(lead.name, urlEvidence));
    return (isSocial(link) && match >= 0.55) || (!isSocial(link) && !isDirectory(link) && match >= 0.75);
  });

  if (firstPassHasEvidence) {
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
  if (!externalVerificationConfigured()) {
    return {
      status: "unverified",
      score: 0,
      reasons: ["Verificação web indisponível: configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX no Render."],
      checked: false,
      foundDigitalPresence: false,
      contactConfidence: confidence,
    };
  }

  const search = await searchLeadPresence(lead);
  if (search.successfulQueries < 2 || search.items.length === 0) {
    return {
      status: "unverified",
      score: 0,
      reasons: [
        search.successfulQueries < 2
          ? "A busca web não respondeu com evidência suficiente para confirmar este negócio."
          : "A busca respondeu, mas não trouxe evidência suficiente para confirmar este negócio.",
      ],
      checked: false,
      foundDigitalPresence: false,
      contactConfidence: confidence,
    };
  }

  const reasons: string[] = [];
  let foundDigitalPresence = false;

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
      reasons.push(`Possível site oficial encontrado com correspondência de ${Math.round(combinedMatch * 100)}%.`);
      break;
    }
  }

  if (foundDigitalPresence) {
    return { status: "rejected", score: 0, reasons, checked: true, foundDigitalPresence: true, contactConfidence: confidence };
  }

  reasons.push("Nenhuma presença digital comercial com correspondência forte foi encontrada nas consultas externas.");

  return {
    status: "verified",
    score: 100,
    reasons,
    checked: true,
    foundDigitalPresence: false,
    contactConfidence: confidence,
  };
}

export async function verifyLeads(
  leads: Establishment[],
): Promise<(Establishment & { verification: LeadVerification })[]> {
  const output: (Establishment & { verification: LeadVerification })[] = [];
  // Mais paralelismo reduz bastante o tempo total quando há muitos candidatos,
  // sem disparar dezenas de chamadas simultâneas de uma vez.
  const concurrency = 6;
  for (let i = 0; i < leads.length; i += concurrency) {
    const batch = leads.slice(i, i + concurrency);
    const verified = await Promise.all(batch.map(async (lead) => ({ ...lead, verification: await verifyLead(lead) })));
    output.push(...verified);
  }
  return output;
}

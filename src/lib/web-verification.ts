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
  url.searchParams.set("safe", "off");

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

  // Poucas consultas de alta informação. O CSE é a etapa cara da verificação;
  // três buscas bem direcionadas são preferíveis a seis buscas paralelas por lead.
  const queries = [
    `"${cleanName}" "${location}" (site:instagram.com OR site:facebook.com OR site:tiktok.com)`,
    `"${cleanName}" "${location}" "${address}"`.trim(),
    phone ? `"${phone}" "${cleanName}"` : `"${cleanName}" "${location}" official`,
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
  if (!externalVerificationConfigured()) {
    return {
      status: "unverified",
      score: confidence === "high" ? 70 : 60,
      reasons: ["Verificação externa não configurada."],
      checked: false,
      foundDigitalPresence: false,
      contactConfidence: confidence,
    };
  }

  const search = await searchLeadPresence(lead);
  if (search.successfulQueries === 0 || search.items.length === 0) {
    return {
      status: "unverified",
      score: confidence === "high" ? 70 : 60,
      reasons: [
        search.successfulQueries === 0
          ? "Não foi possível obter resultados do mecanismo de pesquisa externo."
          : "O mecanismo respondeu, mas não retornou evidência suficiente para verificar este negócio.",
      ],
      checked: false,
      foundDigitalPresence: false,
      contactConfidence: confidence,
    };
  }

  const reasons: string[] = [];
  let score = 100;
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
      score -= 90;
      reasons.push(`Presença social encontrada com correspondência de ${Math.round(combinedMatch * 100)}%.`);
      break;
    }

    if (!isSocial(link) && !isDirectory(link) && combinedMatch >= 0.70) {
      foundDigitalPresence = true;
      score -= 85;
      reasons.push(`Possível site oficial encontrado com correspondência de ${Math.round(combinedMatch * 100)}%.`);
      break;
    }
  }

  if (confidence === "medium") score -= 5;
  if (confidence === "low") score -= 40;

  if (foundDigitalPresence) {
    return { status: "rejected", score: Math.max(0, score), reasons, checked: true, foundDigitalPresence: true, contactConfidence: confidence };
  }

  if (confidence === "low") {
    return {
      status: "rejected",
      score: Math.max(0, score),
      reasons: [...reasons, "Nenhum meio de contato acionável foi confirmado."],
      checked: true,
      foundDigitalPresence: false,
      contactConfidence: confidence,
    };
  }

  reasons.push("Nenhuma presença digital comercial com correspondência forte foi encontrada nos resultados obtidos.");

  return {
    status: score >= 85 ? "verified" : "unverified",
    score: Math.max(0, Math.min(100, score)),
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
  const concurrency = 3;
  for (let i = 0; i < leads.length; i += concurrency) {
    const batch = leads.slice(i, i + concurrency);
    const verified = await Promise.all(batch.map(async (lead) => ({ ...lead, verification: await verifyLead(lead) })));
    output.push(...verified);
  }
  return output;
}

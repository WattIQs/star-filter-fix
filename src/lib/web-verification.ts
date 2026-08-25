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

function env(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env[name]?.trim() || undefined : undefined;
}

export function externalVerificationConfigured(): boolean {
  return Boolean(env("GOOGLE_SEARCH_API_KEY") && env("GOOGLE_SEARCH_CX"));
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
    return [
      "instagram.com", "facebook.com", "tiktok.com", "youtube.com",
      "linkedin.com", "x.com", "twitter.com",
    ].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function isDirectory(link: string): boolean {
  try {
    const host = new URL(link).hostname.toLowerCase().replace(/^www\./, "");
    return [
      "tripadvisor.com", "yelp.com", "ifood.com.br", "rappi.com.br",
      "ubereats.com", "google.com", "google.com.br", "wikipedia.org",
      "wikidata.org", "openstreetmap.org",
    ].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return true;
  }
}

async function googleSearch(query: string): Promise<SearchItem[]> {
  const key = env("GOOGLE_SEARCH_API_KEY");
  const cx = env("GOOGLE_SEARCH_CX");
  if (!key || !cx) return [];

  const url = new URL("https://customsearch.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "6");
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "br");

  const response = await fetchWithTimeout(
    url.toString(),
    { headers: { Accept: "application/json" } },
    6500,
  );
  if (!response.ok) return [];
  const data = (await response.json()) as { items?: SearchItem[] };
  return data.items ?? [];
}

async function searchLeadPresence(lead: Establishment): Promise<SearchItem[]> {
  const cleanName = lead.name.replace(/"/g, "").trim();
  const location = [
    lead.details.neighbourhood,
    lead.details.city,
    lead.details.state,
  ].filter(Boolean).join(" ");
  const address = [lead.details.street, lead.details.housenumber].filter(Boolean).join(" ");
  const phone = lead.contact.phoneDigits ?? "";

  const queries = [
    `"${cleanName}" "${location}" site:instagram.com`,
    `"${cleanName}" "${location}" site:facebook.com`,
    `"${cleanName}" "${location}" site:tiktok.com`,
    `"${cleanName}" "${location}" site:youtube.com`,
    `"${cleanName}" "${location}" ${address}`,
    phone ? `"${phone}" "${cleanName}"` : `"${cleanName}" "${location}" official`,
  ];

  const batches = await Promise.all(queries.map((query) => googleSearch(query)));
  return batches.flat();
}

/**
 * Qualifica com prioridade máxima à precisão.
 * Um resultado externo só invalida o Sinal Zero quando há correspondência forte
 * entre o negócio e o perfil/site encontrado.
 */
export async function verifyLead(lead: Establishment): Promise<LeadVerification> {
  if (!externalVerificationConfigured()) {
    return {
      status: "unverified",
      score: 50,
      reasons: ["Verificação externa não configurada."],
      checked: false,
      foundDigitalPresence: false,
      contactConfidence: lead.contact.whatsappValid
        ? "high"
        : lead.contact.phoneDigits
          ? "medium"
          : "low",
    };
  }

  const items = await searchLeadPresence(lead);
  const reasons: string[] = [];
  let score = 100;
  let foundDigitalPresence = false;

  for (const item of items) {
    const link = item.link ?? "";
    if (!link) continue;

    const evidence = `${item.title ?? ""} ${item.snippet ?? ""}`;
    const urlEvidence = pathIdentity(link);
    const nameMatch = similarity(lead.name, evidence);
    const urlMatch = similarity(lead.name, urlEvidence);
    const locationText = [lead.details.neighbourhood, lead.details.city, lead.details.state]
      .filter(Boolean)
      .join(" ");
    const locationMatch = locationText ? similarity(locationText, evidence) : 0;

    const combinedMatch = Math.max(
      nameMatch,
      urlMatch,
      nameMatch * 0.7 + locationMatch * 0.3,
    );

    // Perfil social: exige identidade do nome no resultado ou na própria URL.
    if (isSocial(link) && combinedMatch >= 0.55) {
      foundDigitalPresence = true;
      score -= 90;
      reasons.push(
        `Presença social encontrada com correspondência de ${Math.round(combinedMatch * 100)}%.`,
      );
      break;
    }

    // Site próprio: exclui diretórios e exige correspondência de negócio.
    if (!isSocial(link) && !isDirectory(link) && combinedMatch >= 0.70) {
      foundDigitalPresence = true;
      score -= 85;
      reasons.push(
        `Possível site oficial encontrado com correspondência de ${Math.round(combinedMatch * 100)}%.`,
      );
      break;
    }
  }

  const contactConfidence = lead.contact.whatsappValid
    ? "high"
    : lead.contact.phoneDigits
      ? "medium"
      : "low";

  if (contactConfidence === "medium") score -= 5;
  if (contactConfidence === "low") score -= 40;

  if (foundDigitalPresence) {
    return {
      status: "rejected",
      score: Math.max(0, score),
      reasons,
      checked: true,
      foundDigitalPresence: true,
      contactConfidence,
    };
  }

  if (contactConfidence === "low") {
    return {
      status: "rejected",
      score: Math.max(0, score),
      reasons: [...reasons, "Nenhum meio de contato acionável foi confirmado."],
      checked: true,
      foundDigitalPresence: false,
      contactConfidence,
    };
  }

  reasons.push("Nenhuma presença digital comercial com correspondência forte foi encontrada.");

  return {
    status: score >= 85 ? "verified" : "unverified",
    score: Math.max(0, Math.min(100, score)),
    reasons,
    checked: true,
    foundDigitalPresence: false,
    contactConfidence,
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

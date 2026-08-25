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

function locationMatch(lead: Establishment, text: string): boolean {
  const source = normalize(text);
  const locationTokens = [lead.details.neighbourhood, lead.details.city, lead.details.state]
    .flatMap((value) => (value ? tokens(value) : []));
  return locationTokens.some((token) => source.includes(token));
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

function socialProfileMatches(lead: Establishment, link: string, evidence: string): boolean {
  const score = similarity(lead.name, evidence);
  const location = locationMatch(lead, evidence);
  let path = "";
  try {
    path = new URL(link).pathname.toLowerCase();
  } catch {
    return false;
  }
  const nameTokens = tokens(lead.name);
  const usernameMatch = nameTokens.length > 0 && nameTokens.some((token) => path.includes(token));
  // A social result is considered a real hit only when it has strong identity
  // evidence. This prevents common words/names from eliminating good leads.
  return score >= 0.75 && (location || usernameMatch);
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
    6000,
  );
  if (!response.ok) return [];
  const data = (await response.json()) as { items?: SearchItem[] };
  return data.items ?? [];
}

export async function verifyLead(lead: Establishment): Promise<LeadVerification> {
  const contactConfidence = lead.contact.whatsappValid
    ? "high"
    : lead.contact.phoneDigits
      ? "medium"
      : "low";

  if (!externalVerificationConfigured()) {
    return {
      status: "unverified",
      score: contactConfidence === "high" ? 90 : 80,
      reasons: ["Verificação externa não configurada; candidato preservado pela verificação local."],
      checked: false,
      foundDigitalPresence: false,
      contactConfidence,
    };
  }

  const location = [lead.details.neighbourhood, lead.details.city, lead.details.state]
    .filter(Boolean)
    .join(" ");
  const cleanName = lead.name.replace(/"/g, "");

  const [general, instagram, facebook] = await Promise.all([
    googleSearch(`"${cleanName}" ${location}`.trim()),
    googleSearch(`"${cleanName}" ${location} site:instagram.com`.trim()),
    googleSearch(`"${cleanName}" ${location} site:facebook.com`.trim()),
  ]);

  const all = [...general, ...instagram, ...facebook];
  const reasons: string[] = [];
  let foundDigitalPresence = false;
  let score = contactConfidence === "high" ? 100 : 90;

  for (const item of all) {
    const link = item.link ?? "";
    if (!link) continue;
    const evidence = `${item.title ?? ""} ${item.snippet ?? ""}`;
    const nameScore = similarity(lead.name, evidence);

    if (isSocial(link) && socialProfileMatches(lead, link, evidence)) {
      foundDigitalPresence = true;
      reasons.push(`Perfil social correspondente encontrado (${Math.round(nameScore * 100)}% de correspondência).`);
      score = 0;
      break;
    }

    if (!isSocial(link) && !isDirectory(link)) {
      const strongSiteMatch = nameScore >= 0.85 && locationMatch(lead, evidence);
      if (strongSiteMatch) {
        foundDigitalPresence = true;
        reasons.push("Site externo com forte correspondência de nome e localização encontrado.");
        score = 0;
        break;
      }
    }
  }

  if (foundDigitalPresence) {
    return {
      status: "rejected",
      score: 0,
      reasons,
      checked: true,
      foundDigitalPresence: true,
      contactConfidence,
    };
  }

  if (contactConfidence === "low") {
    return {
      status: "rejected",
      score: 20,
      reasons: ["Nenhum meio de contato acionável foi confirmado."],
      checked: true,
      foundDigitalPresence: false,
      contactConfidence,
    };
  }

  reasons.push("Nenhuma presença digital comercial com correspondência forte foi encontrada.");
  return {
    status: "verified",
    score,
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
  const concurrency = 4;
  for (let i = 0; i < leads.length; i += concurrency) {
    const batch = leads.slice(i, i + concurrency);
    const verified = await Promise.all(
      batch.map(async (lead) => ({ ...lead, verification: await verifyLead(lead) })),
    );
    output.push(...verified);
  }
  return output;
}

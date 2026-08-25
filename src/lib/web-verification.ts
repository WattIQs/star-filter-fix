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

type SearchItem = {
  link?: string;
  title?: string;
  snippet?: string;
};

function env(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env[name]?.trim() || undefined : undefined;
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
  return normalize(value).split(" ").filter((t) => t.length >= 3);
}

function similarity(name: string, text: string): number {
  const source = normalize(text);
  const wanted = tokens(name);
  if (!wanted.length) return 0;
  const hits = wanted.filter((token) => source.includes(token)).length;
  return hits / wanted.length;
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
      "tripadvisor.com",
      "yelp.com",
      "ifood.com.br",
      "rappi.com.br",
      "ubereats.com",
      "google.com",
      "google.com.br",
      "facebook.com",
      "instagram.com",
      "tiktok.com",
      "linkedin.com",
      "youtube.com",
      "wikipedia.org",
      "wikidata.org",
      "openstreetmap.org",
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
  url.searchParams.set("num", "5");
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "br");

  const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 7000);
  if (!response.ok) return [];
  const data = (await response.json()) as { items?: SearchItem[] };
  return data.items ?? [];
}

/**
 * Verifica candidatos somente quando o Google Programmable Search está configurado.
 * Sem as credenciais, não inventa uma confirmação: devolve `unverified`.
 */
export async function verifyLead(lead: Establishment): Promise<LeadVerification> {
  const configured = Boolean(env("GOOGLE_SEARCH_API_KEY") && env("GOOGLE_SEARCH_CX"));
  if (!configured) {
    return {
      status: "unverified",
      score: 50,
      reasons: ["Verificação externa não configurada."],
      checked: false,
      foundDigitalPresence: false,
      contactConfidence: lead.contact.whatsappValid ? "medium" : "low",
    };
  }

  const location = [lead.details.neighbourhood, lead.details.city, lead.details.state].filter(Boolean).join(" ");
  const base = `"${lead.name.replace(/"/g, "")}" ${location}`.trim();
  const [general, instagram, facebook] = await Promise.all([
    googleSearch(base),
    googleSearch(`"${lead.name.replace(/"/g, "")}" ${location} site:instagram.com`),
    googleSearch(`"${lead.name.replace(/"/g, "")}" ${location} site:facebook.com`),
  ]);

  const all = [...general, ...instagram, ...facebook];
  let score = 100;
  const reasons: string[] = [];
  let foundDigitalPresence = false;

  for (const item of all) {
    const link = item.link ?? "";
    if (!link) continue;
    const evidence = `${item.title ?? ""} ${item.snippet ?? ""}`;
    const match = similarity(lead.name, evidence);

    if (isSocial(link) && match >= 0.5) {
      foundDigitalPresence = true;
      score -= 70;
      reasons.push(`Perfil social encontrado com correspondência de ${Math.round(match * 100)}%.`);
      break;
    }

    if (!isSocial(link) && !isDirectory(link) && match >= 0.6) {
      foundDigitalPresence = true;
      score -= 65;
      reasons.push("Possível site oficial encontrado com correspondência de nome.");
      break;
    }
  }

  const contactConfidence = lead.contact.whatsappValid
    ? "high"
    : lead.contact.phoneDigits
      ? "medium"
      : "low";

  if (contactConfidence === "high") score += 0;
  else if (contactConfidence === "medium") score -= 10;
  else score -= 30;

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

  reasons.push("Nenhuma presença digital comercial correspondente encontrada na busca externa.");
  return {
    status: score >= 85 ? "verified" : "unverified",
    score: Math.max(0, Math.min(100, score)),
    reasons,
    checked: true,
    foundDigitalPresence: false,
    contactConfidence,
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

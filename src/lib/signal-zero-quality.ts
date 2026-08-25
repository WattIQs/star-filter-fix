import type { Establishment } from "./types";

const DIRECT_DIGITAL_KEYS = [
  "website", "contact:website", "url", "contact:url",
  "instagram", "contact:instagram",
  "facebook", "contact:facebook",
  "tiktok", "contact:tiktok",
  "youtube", "contact:youtube",
  "linkedin", "contact:linkedin",
  "twitter", "contact:twitter", "x", "contact:x",
  "email", "contact:email",
];

const CHAIN_PATTERNS = [
  "mcdonald", "burger king", "subway", "starbucks", "kfc", "pizza hut",
  "domino", "habib", "giraffas", "spoleto", "madero", "outback",
  "coco bambu", "china in box", "ragazzo", "carrefour", "assai",
  "atacadao", "pao de acucar", "extra", "oxxo", "drogasil", "droga raia",
  "raia drogasil", "drogaria sao paulo", "drogarias pacheco", "pague menos",
  "panvel", "ultrafarma", "smart fit", "bluefit", "selfit", "bio ritmo",
  "renner", "riachuelo", "cea", "marisa", "centauro", "netshoes", "cobasi",
  "petz", "leroy merlin", "telhanorte",
];

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasValue(tags: Record<string, string>, keys: string[]): boolean {
  return keys.some((key) => Boolean(tags[key]?.trim()));
}

function looksLikeKnownChain(tags: Record<string, string>): boolean {
  const identity = normalize(
    [tags.name, tags.brand, tags.operator, tags.official_name].filter(Boolean).join(" "),
  );
  if (!identity) return false;
  return CHAIN_PATTERNS.some((pattern) => identity.includes(pattern));
}

function hasClearlyDigitalTag(tags: Record<string, string>): boolean {
  return hasValue(tags, DIRECT_DIGITAL_KEYS);
}

/**
 * Sinal Zero é determinado somente por evidência comercial real.
 * Wikidata/Wikipedia/brand/operator não são considerados presença digital.
 */
export function isStrictSignalZero(place: Establishment): boolean {
  const tags = place.tags ?? {};

  if (hasClearlyDigitalTag(tags)) return false;
  if (looksLikeKnownChain(tags)) return false;

  // Não usamos mais place.level como gate, porque versões anteriores do
  // classificador podiam elevar o nível por metadados não comerciais.
  return true;
}

/** Score local antes da verificação externa. Quanto maior, mais promissor. */
export function getSignalZeroScore(place: Establishment): number {
  const tags = place.tags ?? {};
  let score = 100;
  if (hasClearlyDigitalTag(tags)) score -= 100;
  if (looksLikeKnownChain(tags)) score -= 80;
  if (place.contact.whatsappValid) score += 0;
  else if (place.contact.phoneDigits) score -= 5;
  else score -= 50;
  return Math.max(0, Math.min(100, score));
}

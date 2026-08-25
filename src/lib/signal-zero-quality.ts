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
    [tags.name, tags.brand, tags.operator, tags.official_name]
      .filter(Boolean)
      .join(" "),
  );
  if (!identity) return false;
  return CHAIN_PATTERNS.some((pattern) => identity.includes(pattern));
}

function hasClearlyDigitalTag(tags: Record<string, string>): boolean {
  return hasValue(tags, DIRECT_DIGITAL_KEYS);
}

/**
 * Sinal Zero é um estado de oportunidade, não um reflexo cego do campo `level`.
 * OSM pode ter wikidata/wikipedia/brand/operator sem possuir presença digital
 * comercial do negócio. Por isso esses metadados não eliminam o candidato.
 */
export function isStrictSignalZero(place: Establishment): boolean {
  const tags = place.tags ?? {};

  if (hasClearlyDigitalTag(tags)) return false;
  if (looksLikeKnownChain(tags)) return false;

  // Se o classificador original marcou zero, aceitamos imediatamente.
  if (place.level === "zero") return true;

  // Compatibilidade com classificações antigas: `weak/full` podem ter sido
  // causados apenas por Wikidata/Wikipedia/brand metadata. Reavaliamos usando
  // somente sinais comerciais explícitos, evitando falso negativo.
  const hasOnlyMetadata = [
    "wikidata", "wikipedia", "brand:wikidata", "brand:wikipedia",
    "operator:wikidata", "operator:wikipedia", "brand", "operator",
  ].some((key) => Boolean(tags[key]?.trim()));

  return hasOnlyMetadata && !hasClearlyDigitalTag(tags);
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
  if (place.level === "zero") score += 5;
  return Math.max(0, Math.min(100, score));
}

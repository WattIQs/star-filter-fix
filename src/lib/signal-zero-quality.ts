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

/**
 * Local Sinal Zero gate.
 *
 * Important: OSM metadata such as brand/operator/Wikidata is not treated as
 * commercial digital presence by itself, because many legitimate local
 * businesses have those fields populated. Only explicit commercial channels
 * or a clearly recognized chain are rejected here.
 */
export function isStrictSignalZero(place: Establishment): boolean {
  const tags = place.tags ?? {};

  if (hasValue(tags, DIRECT_DIGITAL_KEYS)) return false;
  if (looksLikeKnownChain(tags)) return false;
  if (place.level !== "zero") return false;

  return true;
}

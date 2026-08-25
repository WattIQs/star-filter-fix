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

const NOTABLE_KEYS = [
  "brand", "operator", "brand:wikidata", "brand:wikipedia",
  "operator:wikidata", "operator:wikipedia", "wikidata", "wikipedia",
];

const CHAIN_PATTERNS = [
  "mcdonald", "burger king", "subway", "starbucks", "kfc", "pizza hut",
  "domino", "habib", "giraffas", "bob's", "bobs", "spoleto", "madero",
  "outback", "coco bambu", "china in box", "ragazzo", "carrefour", "assai",
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

function looksLikeChainOrNotable(tags: Record<string, string>): boolean {
  if (hasValue(tags, ["brand", "operator", "brand:wikidata", "brand:wikipedia", "operator:wikidata", "operator:wikipedia"])) return true;
  // Wikidata/Wikipedia alone are not counted as digital presence, but are a strong
  // noise signal for this prospecting product because notable businesses are often mapped there.
  if (hasValue(tags, ["wikidata", "wikipedia"])) return true;

  const identity = normalize([tags.name, tags.brand, tags.operator, tags.official_name].filter(Boolean).join(" "));
  return CHAIN_PATTERNS.some((pattern) => identity.includes(pattern));
}

function ratingFromTags(tags: Record<string, string>): number | null {
  const raw = tags["rating"] ?? tags["rating:average"] ?? tags["stars"];
  if (!raw) return null;
  const value = Number.parseFloat(raw.replace(",", ".").replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) ? value : null;
}

/**
 * Strict prospecting gate. It intentionally prefers precision over recall:
 * a lead only passes when OSM contains no direct digital-presence signal and
 * no strong chain/notability signal.
 */
export function isStrictSignalZero(place: Establishment): boolean {
  const tags = place.tags ?? {};

  if (hasValue(tags, DIRECT_DIGITAL_KEYS)) return false;
  if (looksLikeChainOrNotable(tags)) return false;

  // Very highly rated mapped businesses are usually poor prospecting targets.
  // Only apply this when OSM actually provides a rating; never invent one.
  const rating = place.rating ?? ratingFromTags(tags);
  if (rating !== null && rating >= 4.8) return false;

  // If the original classifier says there is any direct digital signal, reject it.
  if (place.level !== "zero") return false;

  return true;
}

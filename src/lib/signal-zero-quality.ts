import type { Establishment } from "./types";

const DIRECT_DIGITAL_KEYS = ["website", "contact:website", "url", "contact:url", "instagram", "contact:instagram", "facebook", "contact:facebook", "tiktok", "contact:tiktok", "youtube", "contact:youtube", "linkedin", "contact:linkedin", "twitter", "contact:twitter", "x", "contact:x"];

function hasValue(tags: Record<string, string>, keys: string[]): boolean {
  return keys.some((key) => Boolean(tags[key]?.trim()));
}

// A ausência de tags no OSM não prova ausência de presença digital.
// Todo estabelecimento nomeado segue para a verificação web.
export function isStrictSignalZero(_place: Establishment): boolean {
  return true;
}

export function getSignalZeroScore(place: Establishment): number {
  const tags = place.tags ?? {};
  let score = 100;
  if (hasValue(tags, DIRECT_DIGITAL_KEYS)) score -= 70;
  if (place.contact.whatsappValid) score += 0;
  else if (place.contact.phoneDigits) score -= 5;
  else score -= 10;
  return Math.max(0, Math.min(100, score));
}

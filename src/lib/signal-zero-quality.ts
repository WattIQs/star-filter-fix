import type { Establishment } from "./types";

const DIRECT_DIGITAL_KEYS = [
  "website", "contact:website", "url", "contact:url",
  "instagram", "contact:instagram",
  "facebook", "contact:facebook",
  "tiktok", "contact:tiktok",
  "youtube", "contact:youtube",
  "linkedin", "contact:linkedin",
  "twitter", "contact:twitter",
  "x", "contact:x",
];

function hasValue(tags: Record<string, string>, keys: string[]): boolean {
  return keys.some((key) => Boolean(tags[key]?.trim()));
}

/**
 * Returns whether a lead is provisionally eligible for external Sinal Zero verification.
 * The absence of OSM tags alone never proves Sinal Zero.
 */
export function isStrictSignalZero(place: Establishment): boolean {
  return !hasValue(place.tags ?? {}, DIRECT_DIGITAL_KEYS)
    && !place.contact.whatsappValid
    && !place.contact.instagramUrl;
}

export function getSignalZeroScore(place: Establishment): number {
  const tags = place.tags ?? {};
  let score = 100;
  if (hasValue(tags, DIRECT_DIGITAL_KEYS)) score -= 70;
  if (place.contact.whatsappValid || place.contact.instagramUrl) score -= 20;
  if (!place.contact.phoneDigits) score -= 10;
  return Math.max(0, Math.min(100, score));
}

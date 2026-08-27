import type { Establishment } from "./types";

function hasValue(tags: Record<string, string>, keys: string[]): boolean {
  return keys.some((key) => Boolean(tags[key]?.trim()));
}

// Strict Sinal Zero = no own website, no Instagram and no explicitly tagged WhatsApp.
// Other channels (phone, email, Facebook, directories) do not remove the lead from this segment.
export function isStrictSignalZero(place: Establishment): boolean {
  const tags = place.tags ?? {};
  const website = hasValue(tags, ["website", "contact:website", "url", "contact:url"]);
  const instagram = hasValue(tags, ["instagram", "contact:instagram"]);
  return !website && !instagram && !place.contact.whatsappValid;
}

export function getSignalZeroScore(place: Establishment): number {
  return isStrictSignalZero(place) ? 100 : 0;
}

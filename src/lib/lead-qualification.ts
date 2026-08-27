import type { CategoryKey, EstablishmentContact, EstablishmentDetails, SignalLevel } from "./types";
import { CATEGORIES, OSM_VALUE_LABELS, type Establishment } from "./types";

function getTag(tags: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = tags[key];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

const WELL_KNOWN_BRANDS = ["mcdonalds", "mcdonald's", "burger king", "subway", "starbucks", "kfc", "pizza hut", "domino's", "dominos", "habib's", "habibs", "giraffas", "spoleto", "madero", "outback", "coco bambu", "china in box", "ragazzo", "carrefour", "assai", "assaí", "atacadao", "atacadão", "pao de acucar", "pão de açúcar", "extra", "dia", "oxxo", "drogasil", "droga raia", "raia drogasil", "drogaria sao paulo", "drogaria são paulo", "drogarias pacheco", "pague menos", "panvel", "ultrafarma", "smart fit", "bluefit", "selfit", "bio ritmo", "renner", "riachuelo", "cea", "c&a", "marisa", "centauro", "netshoes", "cobasi", "petz", "leroy merlin", "telhanorte"];

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9&' ]/g, " ").replace(/\s+/g, " ").trim();
}

function hasTag(tags: Record<string, string>, keys: string[]): boolean {
  return getTag(tags, keys) !== null;
}

function hasWellKnownBrand(tags: Record<string, string>): boolean {
  const haystack = normalizeText([tags.name, tags.brand, tags.operator, tags.official_name].filter(Boolean).join(" "));
  return !!haystack && WELL_KNOWN_BRANDS.some((brand) => {
    const normalized = normalizeText(brand);
    return haystack === normalized || haystack.includes(normalized);
  });
}

export function classifySignals(tags: Record<string, string>, contact?: EstablishmentContact) {
  const website = hasTag(tags, ["website", "contact:website", "url", "contact:url"]);
  const instagram = hasTag(tags, ["contact:instagram", "instagram"]);
  const facebook = hasTag(tags, ["contact:facebook", "facebook"]);
  const email = hasTag(tags, ["email", "contact:email"]);
  const phone = hasTag(tags, ["phone", "contact:phone", "contact:mobile", "mobile"]);
  const whatsapp = Boolean(contact?.whatsappValid) || hasTag(tags, ["contact:whatsapp", "whatsapp"]);
  const signalCount = [website, instagram, whatsapp].filter(Boolean).length;
  const level: SignalLevel = signalCount >= 2 ? "full" : signalCount === 1 ? "weak" : "zero";
  return { signals: { website, instagram, facebook, email, phone }, signalCount, level, knownBrand: hasWellKnownBrand(tags) };
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, "")}`;
}

function instagramFromValue(value: string | null) {
  if (!value) return { handle: null, url: null };
  const match = value.trim().match(/(?:instagram\.com\/|@)([A-Za-z0-9_.]+)/i);
  if (!match?.[1]) return { handle: null, url: null };
  const handle = match[1].replace(/[^A-Za-z0-9_.]/g, "");
  return handle.length < 2 ? { handle: null, url: null } : { handle: `@${handle}`, url: `https://instagram.com/${handle}` };
}

export function toWhatsappNumber(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(/[;,/]/)[0] ?? raw;
  let digits = first.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return null;
  const country = /^\s*\+/.test(first) || first.trim().startsWith("00");
  if (!country && (digits.length === 10 || digits.length === 11)) digits = `55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const local = digits.slice(2);
    const ddd = Number(local.slice(0, 2));
    const subscriber = local.slice(2);
    if (ddd >= 11 && ddd <= 99 && subscriber.length === 9 && subscriber.startsWith("9")) return digits;
    return null;
  }
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

function buildContact(tags: Record<string, string>): EstablishmentContact {
  const phoneRaw = getTag(tags, ["contact:mobile", "mobile", "phone", "contact:phone"]);
  const explicitWhatsapp = getTag(tags, ["contact:whatsapp", "whatsapp"]);
  const phoneDigits = phoneRaw ? phoneRaw.replace(/\D/g, "") : null;
  const whatsappNumber = toWhatsappNumber(explicitWhatsapp) ?? toWhatsappNumber(phoneRaw);
  const ig = instagramFromValue(getTag(tags, ["contact:instagram", "instagram"]));
  return {
    phoneRaw,
    phoneDigits,
    whatsappUrl: whatsappNumber ? `https://wa.me/${whatsappNumber}` : null,
    whatsappValid: whatsappNumber !== null,
    instagramHandle: ig.handle,
    instagramUrl: ig.url,
    facebookUrl: normalizeUrl(getTag(tags, ["contact:facebook", "facebook"])),
    websiteUrl: normalizeUrl(getTag(tags, ["website", "contact:website"])),
    email: getTag(tags, ["email", "contact:email"]),
  };
}

const CUISINE_LABELS: Record<string, string> = { pizza: "Pizzaria", burger: "Hamburgueria", regional: "Regional", brazilian: "Brasileira", italian: "Italiana", japanese: "Japonesa", chinese: "Chinesa", coffee_shop: "Cafeteria", ice_cream: "Sorveteria", sandwich: "Sanduíches", bakery: "Padaria", barbecue: "Churrasco", steak_house: "Steakhouse", seafood: "Frutos do mar", vegetarian: "Vegetariana", mexican: "Mexicana", arab: "Árabe" };
function formatCuisine(value: string | null): string | null { return value ? value.split(";").map((c) => CUISINE_LABELS[c.trim()] ?? c.trim().replace(/_/g, " ")).join(", ") : null; }
function buildDetails(tags: Record<string, string>): EstablishmentDetails { return { cuisine: formatCuisine(getTag(tags, ["cuisine"])), openingHours: getTag(tags, ["opening_hours"]), priceRange: getTag(tags, ["price_range", "price"]), street: getTag(tags, ["addr:street"]), housenumber: getTag(tags, ["addr:housenumber"]), neighbourhood: getTag(tags, ["addr:suburb", "addr:neighbourhood"]), city: getTag(tags, ["addr:city"]), state: getTag(tags, ["addr:state"]), postcode: getTag(tags, ["addr:postcode"]), takeaway: getTag(tags, ["takeaway"]), delivery: getTag(tags, ["delivery"]), outdoorSeating: getTag(tags, ["outdoor_seating"]), wheelchair: getTag(tags, ["wheelchair"]), smoking: getTag(tags, ["smoking"]), vegetarian: getTag(tags, ["diet:vegetarian"]), airConditioning: getTag(tags, ["air_conditioning"]), capacity: getTag(tags, ["capacity", "capacity:seats"]), brand: getTag(tags, ["brand"]), operator: getTag(tags, ["operator"]) }; }
function extractRating(tags: Record<string, string>): number | null { const raw = getTag(tags, ["stars", "rating", "rating:average"]); if (!raw) return null; const value = Number.parseFloat(raw.replace(",", ".").replace(/[^\d.]/g, "")); return Number.isFinite(value) && value > 0 ? Math.min(5, Math.round(value * 10) / 10) : null; }
function extractPriceLevel(tags: Record<string, string>): 1 | 2 | 3 | null { const raw = getTag(tags, ["price_range", "price", "price:level"]); if (!raw) return null; const value = raw.toLowerCase(); if (/^\$+$/.test(value) || /^€+$/.test(value)) return Math.min(3, Math.max(1, (value.match(/[$€]/g) ?? []).length)) as 1 | 2 | 3; if (/cheap|budget|low|barato|econ/.test(value)) return 1; if (/moderate|medium|mid|m[eé]dio/.test(value)) return 2; if (/expensive|high|luxury|caro|alto/.test(value)) return 3; const num = Number.parseFloat(value.replace(",", ".")); return Number.isFinite(num) ? num <= 30 ? 1 : num <= 90 ? 2 : 3 : null; }
function buildAddress(tags: Record<string, string>): string { const parts: string[] = []; const street = tags["addr:street"], number = tags["addr:housenumber"]; if (street) parts.push(number ? `${street}, ${number}` : street); const suburb = tags["addr:suburb"] ?? tags["addr:neighbourhood"]; if (suburb) parts.push(suburb); if (tags["addr:city"]) parts.push(tags["addr:city"]); if (tags["addr:state"]) parts.push(tags["addr:state"]); return parts.join(" · ") || ""; }
function resolveCategory(tags: Record<string, string>): { label: string; key: CategoryKey | null } { const matches = (Object.keys(CATEGORIES) as CategoryKey[]).filter((candidate) => CATEGORIES[candidate].filters.some((filter) => tags[filter.key] !== undefined && filter.values.includes(tags[filter.key] as string))); const key = matches[0] ?? null; const osmValue = tags.amenity ?? tags.shop ?? tags.leisure ?? ""; return { label: OSM_VALUE_LABELS[osmValue] ?? (key ? CATEGORIES[key].label : osmValue.replace(/_/g, " ") || "Estabelecimento"), key }; }

export function processOverpassResults(elements: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }>, categories: CategoryKey[]): Establishment[] {
  const categorySet = new Set(categories), seen = new Set<string>(), results: Establishment[] = [];
  for (const element of elements) {
    const tags = element.tags ?? {}, name = getTag(tags, ["name", "official_name"]), center = element.center ?? (element.lat !== undefined && element.lon !== undefined ? { lat: element.lat, lon: element.lon } : null);
    if (!name || !center) continue;
    const resolved = resolveCategory(tags);
    if (categorySet.size > 0 && (!resolved.key || !categorySet.has(resolved.key))) continue;
    const id = `${element.type}-${element.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const contact = buildContact(tags);
    const classification = classifySignals(tags, contact), details = buildDetails(tags), rating = extractRating(tags), priceLevel = extractPriceLevel(tags);
    results.push({ id, osmType: element.type, osmId: element.id, name, category: resolved.label, categoryKey: resolved.key, address: buildAddress(tags), lat: center.lat, lon: center.lon, tags, signals: classification.signals, contact, details, contactable: Boolean(contact.whatsappValid || contact.instagramUrl), signalCount: classification.signalCount, level: classification.level, rating, priceLevel, googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${center.lat},${center.lon}`)}`, osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`, directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lon}` });
  }
  return results;
}

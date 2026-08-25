import type {
  CategoryKey,
  Establishment,
  EstablishmentContact,
  EstablishmentDetails,
  SignalLevel,
} from "./types";
import { CATEGORIES, OSM_VALUE_LABELS } from "./types";

function getTag(tags: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = tags[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function classifySignals(tags: Record<string, string>) {
  const website = getTag(tags, ["website", "contact:website"]) !== null;
  const instagram = getTag(tags, ["contact:instagram", "instagram"]) !== null;
  const facebook = getTag(tags, ["contact:facebook", "facebook"]) !== null;
  const email = getTag(tags, ["email", "contact:email"]) !== null;
  const phone =
    getTag(tags, [
      "phone",
      "contact:phone",
      "contact:mobile",
      "mobile",
      "contact:whatsapp",
    ]) !== null;

  const signalCount = [website, instagram, facebook, email].filter(Boolean).length;

  let level: SignalLevel;
  if (signalCount === 0) level = "zero";
  else if (signalCount === 1) level = "weak";
  else level = "full";

  return { signals: { website, instagram, facebook, email, phone }, signalCount, level };
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, "")}`;
}

function instagramFromValue(value: string | null): {
  handle: string | null;
  url: string | null;
} {
  if (!value) return { handle: null, url: null };
  const cleaned = value.trim();
  const match = cleaned.match(/instagram\.com\/([A-Za-z0-9_.]+)/i);
  const raw = match?.[1] ?? cleaned.replace(/^@/, "").split(/[/?\s]/)[0] ?? "";
  const handle = raw.replace(/[^A-Za-z0-9_.]/g, "");
  if (!handle || handle.length < 2) return { handle: null, url: null };
  return { handle: `@${handle}`, url: `https://instagram.com/${handle}` };
}

/**
 * Normaliza um telefone para o formato aceito pelo wa.me (só dígitos, com DDI).
 * Retorna null quando o número não pode gerar um link de WhatsApp válido.
 */
export function toWhatsappNumber(raw: string | null): string | null {
  if (!raw) return null;
  // Se houver vários números separados, usa o primeiro.
  const first = raw.split(/[;,/]/)[0] ?? raw;
  let digits = first.replace(/\D/g, "");
  if (!digits) return null;
  digits = digits.replace(/^0+/, "");

  // Números brasileiros sem DDI: 10 (fixo) ou 11 (celular) dígitos com DDD.
  const hasCountryCode = /^\s*\+/.test(first) || first.trim().startsWith("00");
  if (!hasCountryCode && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }
  // Já com DDI 55: 12 ou 13 dígitos.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const local = digits.slice(2);
    const ddd = Number.parseInt(local.slice(0, 2), 10);
    if (ddd < 11 || ddd > 99) return null;
    // Celular precisa começar com 9 após o DDD; fixo começa entre 2 e 5.
    const firstLocal = local.charAt(2);
    if (local.length === 9 && firstLocal !== "9") return null;
    if (local.length === 8 && !"2345".includes(firstLocal)) return null;
    return digits;
  }
  // Outros países: exige tamanho plausível de número internacional.
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

function buildContact(tags: Record<string, string>): EstablishmentContact {
  const phoneRaw = getTag(tags, [
    "contact:whatsapp",
    "contact:mobile",
    "mobile",
    "phone",
    "contact:phone",
  ]);
  const phoneDigits = phoneRaw ? phoneRaw.replace(/\D/g, "") : null;
  const whatsappSource = getTag(tags, ["contact:whatsapp", "whatsapp"]) ?? phoneRaw;
  const whatsappNumber = toWhatsappNumber(whatsappSource);

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

const CUISINE_LABELS: Record<string, string> = {
  pizza: "Pizzaria",
  burger: "Hamburgueria",
  regional: "Regional",
  brazilian: "Brasileira",
  italian: "Italiana",
  japanese: "Japonesa",
  chinese: "Chinesa",
  coffee_shop: "Cafeteria",
  ice_cream: "Sorveteria",
  sandwich: "Sanduíches",
  bakery: "Padaria",
  barbecue: "Churrasco",
  steak_house: "Steakhouse",
  seafood: "Frutos do mar",
  vegetarian: "Vegetariana",
  mexican: "Mexicana",
  arab: "Árabe",
};

function formatCuisine(value: string | null): string | null {
  if (!value) return null;
  return value
    .split(";")
    .map((c) => CUISINE_LABELS[c.trim()] ?? c.trim().replace(/_/g, " "))
    .join(", ");
}

function buildDetails(tags: Record<string, string>): EstablishmentDetails {
  return {
    cuisine: formatCuisine(getTag(tags, ["cuisine"])),
    openingHours: getTag(tags, ["opening_hours"]),
    priceRange: getTag(tags, ["price_range", "price"]),
    street: getTag(tags, ["addr:street"]),
    housenumber: getTag(tags, ["addr:housenumber"]),
    neighbourhood: getTag(tags, ["addr:suburb", "addr:neighbourhood"]),
    city: getTag(tags, ["addr:city"]),
    state: getTag(tags, ["addr:state"]),
    postcode: getTag(tags, ["addr:postcode"]),
    takeaway: getTag(tags, ["takeaway"]),
    delivery: getTag(tags, ["delivery"]),
    outdoorSeating: getTag(tags, ["outdoor_seating"]),
    wheelchair: getTag(tags, ["wheelchair"]),
    smoking: getTag(tags, ["smoking"]),
    vegetarian: getTag(tags, ["diet:vegetarian"]),
    airConditioning: getTag(tags, ["air_conditioning"]),
    capacity: getTag(tags, ["capacity", "capacity:seats"]),
    brand: getTag(tags, ["brand"]),
    operator: getTag(tags, ["operator"]),
  };
}

/** Nota real quando existir nos dados abertos (tags `stars` / `rating`). */
function extractRating(tags: Record<string, string>): number | null {
  const raw = getTag(tags, ["stars", "rating", "rating:average"]);
  if (!raw) return null;
  const value = Number.parseFloat(raw.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(5, Math.round(value * 10) / 10);
}

/** Faixa de preço: 1 barato, 2 médio, 3 caro. */
function extractPriceLevel(tags: Record<string, string>): 1 | 2 | 3 | null {
  const raw = getTag(tags, ["price_range", "price", "price:level"]);
  if (!raw) return null;
  const value = raw.toLowerCase();
  if (/^\$+$/.test(value) || /^€+$/.test(value) || /^r?\$+$/.test(value)) {
    const count = (value.match(/[$€]/g) ?? []).length;
    return (Math.min(3, Math.max(1, count)) as 1 | 2 | 3) ?? null;
  }
  if (/(cheap|budget|low|barato|econ)/.test(value)) return 1;
  if (/(moderate|medium|mid|m[eé]dio)/.test(value)) return 2;
  if (/(expensive|high|luxury|caro|alto)/.test(value)) return 3;
  const num = Number.parseFloat(value.replace(",", "."));
  if (Number.isFinite(num)) {
    if (num <= 30) return 1;
    if (num <= 90) return 2;
    return 3;
  }
  return null;
}

function buildAddress(tags: Record<string, string>): string {
  const parts: string[] = [];
  const street = tags["addr:street"];
  const housenumber = tags["addr:housenumber"];
  if (street) {
    parts.push(housenumber ? `${street}, ${housenumber}` : street);
  }
  const suburb = tags["addr:suburb"] ?? tags["addr:neighbourhood"];
  if (suburb) parts.push(suburb);
  const city = tags["addr:city"];
  if (city) parts.push(city);
  const state = tags["addr:state"];
  if (state) parts.push(state);

  return parts.join(" · ") || "";
}

/** Descobre o valor OSM e a categoria escolhida pelo usuário. */
function resolveCategory(tags: Record<string, string>): {
  label: string;
  key: CategoryKey | null;
  osmValue: string;
} {
  const osmValue = tags["amenity"] ?? tags["shop"] ?? tags["leisure"] ?? "";
  let key: CategoryKey | null = null;
  for (const candidate of Object.keys(CATEGORIES) as CategoryKey[]) {
    const def = CATEGORIES[candidate];
    if (
      def.filters.some(
        (f) => tags[f.key] !== undefined && f.values.includes(tags[f.key] as string)
      )
    ) {
      key = candidate;
      break;
    }
  }
  const label =
    OSM_VALUE_LABELS[osmValue] ??
    (key ? CATEGORIES[key].label : osmValue.replace(/_/g, " ") || "Estabelecimento");
  return { label, key, osmValue };
}

export function processOverpassResults(
  elements: {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }[],
  _categories: CategoryKey[]
): Establishment[] {
  const results: Establishment[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags["name"]?.trim();
    if (!name) continue;

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;

    const category = resolveCategory(tags);
    const { signals, signalCount, level } = classifySignals(tags);
    const contact = buildContact(tags);
    const details = buildDetails(tags);
    const address = buildAddress(tags);

    results.push({
      id: `${el.type}-${el.id}`,
      osmType: el.type,
      osmId: el.id,
      name,
      category: category.label,
      categoryKey: category.key,
      address,
      lat,
      lon,
      tags,
      signals,
      contact,
      details,
      contactable: Boolean(contact.whatsappUrl || contact.instagramUrl),
      signalCount,
      level,
      rating: extractRating(tags),
      priceLevel: extractPriceLevel(tags),
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${name} ${address || `${lat},${lon}`}`
      )}`,
      osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    });
  }

  return results;
}

import { createServerFn } from "@tanstack/react-start";
import type { BoundingBox, CategoryKey, Establishment } from "./types";
import { CATEGORIES } from "./types";
import { buildOverpassQuery } from "./overpass-query";
import { fetchWithTimeout, OSM_UA, OVERPASS_MIRRORS } from "./geo.server";
import { externalVerificationConfigured, verifyLeads, type LeadVerification } from "./web-verification";

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface PlaceSuggestion {
  label: string;
  shortLabel: string;
  lat: number;
  lon: number;
  boundingBox: BoundingBox | null;
}

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
};

function toPlaceSuggestion(r: NominatimResult): PlaceSuggestion {
  const bb = r.boundingbox;
  const parts = r.display_name.split(",").map((p) => p.trim());
  return {
    label: r.display_name,
    shortLabel: parts.slice(0, 3).join(", "),
    lat: Number.parseFloat(r.lat),
    lon: Number.parseFloat(r.lon),
    boundingBox: bb && bb.length >= 4
      ? {
          south: Number.parseFloat(bb[0] ?? "0"),
          north: Number.parseFloat(bb[1] ?? "0"),
          west: Number.parseFloat(bb[2] ?? "0"),
          east: Number.parseFloat(bb[3] ?? "0"),
        }
      : null,
  };
}

function dedupePlaces(results: NominatimResult[]): NominatimResult[] {
  const seen = new Set<string>();
  return results.filter((item) => {
    const key = `${Number(item.lat).toFixed(5)}:${Number(item.lon).toFixed(5)}:${item.display_name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function queryPlaces(q: string): Promise<NominatimResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "8");
  url.searchParams.set("q", q);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("accept-language", "pt-BR");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("dedupe", "1");

  const response = await fetchWithTimeout(
    url.toString(),
    { headers: { Accept: "application/json", "User-Agent": OSM_UA } },
    8000,
  );
  if (!response.ok) return [];
  return (await response.json()) as NominatimResult[];
}

function buildAroundQuery(lat: number, lon: number, categories: CategoryKey[]): string {
  const radius = 15000;
  const byKey = new Map<string, Set<string>>();

  for (const category of categories) {
    for (const filter of CATEGORIES[category]?.filters ?? []) {
      const values = byKey.get(filter.key) ?? new Set<string>();
      filter.values.forEach((value) => values.add(value));
      byKey.set(filter.key, values);
    }
  }

  if (byKey.size === 0) {
    return `[out:json][timeout:20];\n(\nnwr["name"]["amenity"](around:${radius},${lat},${lon});\nnwr["name"]["shop"](around:${radius},${lat},${lon});\nnwr["name"]["leisure"](around:${radius},${lat},${lon});\n);\nout tags center 2000;`;
  }

  const blocks: string[] = [];
  for (const [key, values] of byKey) {
    const escaped = [...values]
      .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    blocks.push(`nwr["${key}"~"^(${escaped})$"](around:${radius},${lat},${lon});`);
  }

  return `[out:json][timeout:20];\n(\n${blocks.join("\n")}\n);\nout tags center 2200;`;
}

async function queryOverpass(query: string): Promise<OverpassElement[] | null> {
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const response = await fetchWithTimeout(
        mirror,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": OSM_UA },
          body: `data=${encodeURIComponent(query)}`,
        },
        22000,
      );
      if (!response.ok) continue;
      const json = (await response.json()) as { elements?: OverpassElement[] };
      return json.elements ?? [];
    } catch {
      // Continue with another Overpass mirror.
    }
  }
  return null;
}

export const searchPlacesServer = createServerFn({ method: "POST" })
  .validator((data: { q: string }) => data)
  .handler(async ({ data }): Promise<PlaceSuggestion[]> => {
    const q = data.q.trim().replace(/\s+/g, " ");
    if (q.length < 2) return [];

    const variants = [q, `${q}, Brasil`];
    if (q.length >= 4) variants.push(q.split(" ").slice(-2).join(" "));

    const batches = await Promise.all(variants.map(queryPlaces));
    const merged = dedupePlaces(batches.flat());

    return merged
      .filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)))
      .slice(0, 8)
      .map(toPlaceSuggestion);
  });

export const searchOverpassServer = createServerFn({ method: "POST" })
  .validator((data: { area: BoundingBox; categories: CategoryKey[]; signalZeroOnly?: boolean }) => data)
  .handler(async ({ data }): Promise<{ elements: OverpassElement[] }> => {
    const primary = await queryOverpass(buildOverpassQuery(data.area, data.categories, data.signalZeroOnly === true));
    if (primary && primary.length > 0) return { elements: primary };

    // Fallback espacial: se uma bbox do Nominatim vier estreita, incompleta ou
    // não casar bem com os objetos OSM, procuramos num raio de 15 km do centro.
    // A busca continua independente do filtro Sinal Zero.
    const centerLat = (data.area.south + data.area.north) / 2;
    const centerLon = (data.area.west + data.area.east) / 2;
    const fallback = await queryOverpass(buildAroundQuery(centerLat, centerLon, data.categories));

    if (fallback && fallback.length > 0) return { elements: fallback };
    if (primary !== null || fallback !== null) return { elements: [] };

    throw new Error("Não foi possível consultar o OpenStreetMap agora. Tente novamente em alguns segundos.");
  });

export const verifyLeadsServer = createServerFn({ method: "POST" })
  .validator((data: { leads: Establishment[] }) => data)
  .handler(async ({ data }): Promise<{
    leads: (Establishment & { verification: LeadVerification })[];
    external: boolean;
    healthy: boolean;
  }> => {
    if (!externalVerificationConfigured()) {
      return {
        leads: data.leads.map((lead) => ({
          ...lead,
          verification: {
            status: "unverified" as const,
            score: 0,
            reasons: ["Busca externa não configurada. O filtro de ausência de site precisa consultar a web antes de confirmar o lead."],
            checked: false,
            foundDigitalPresence: false,
            foundWebsite: false,
            contactConfidence: lead.contact.whatsappValid ? "high" : lead.contact.phoneDigits ? "medium" : "low",
          },
        })),
        external: false,
        healthy: false,
      };
    }

    const candidates = data.leads.slice(0, 24);
    const verified = await verifyLeads(candidates);
    const healthy = verified.some((lead) => lead.verification.checked);
    return { leads: verified, external: healthy, healthy };
  });

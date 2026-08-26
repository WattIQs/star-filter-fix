import { createServerFn } from "@tanstack/react-start";
import type { BoundingBox, CategoryKey, Establishment } from "./types";
import { buildAroundQuery, buildOverpassQuery } from "./overpass-query";
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

type NominatimResult = { display_name: string; lat: string; lon: string; boundingbox?: [string, string, string, string] };

function toPlaceSuggestion(r: NominatimResult): PlaceSuggestion {
  const bb = r.boundingbox;
  const parts = r.display_name.split(",").map((p) => p.trim());
  return { label: r.display_name, shortLabel: parts.slice(0, 3).join(", "), lat: Number.parseFloat(r.lat), lon: Number.parseFloat(r.lon), boundingBox: bb && bb.length >= 4 ? { south: Number.parseFloat(bb[0] ?? "0"), north: Number.parseFloat(bb[1] ?? "0"), west: Number.parseFloat(bb[2] ?? "0"), east: Number.parseFloat(bb[3] ?? "0") } : null };
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

  try {
    const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json", "User-Agent": OSM_UA } }, 4500);
    if (!response.ok) return [];
    return (await response.json()) as NominatimResult[];
  } catch {
    return [];
  }
}

async function queryOverpassMirror(mirror: string, query: string): Promise<OverpassElement[] | null> {
  try {
    const response = await fetchWithTimeout(
      mirror,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": OSM_UA }, body: `data=${encodeURIComponent(query)}` },
      13000,
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { elements?: OverpassElement[] };
    return json.elements ?? [];
  } catch {
    return null;
  }
}

function mergeOverpassResults(responses: Array<OverpassElement[] | null>): OverpassElement[] {
  const byId = new Map<string, OverpassElement>();
  for (const response of responses) {
    if (!response) continue;
    for (const element of response) {
      const key = `${element.type}-${element.id}`;
      if (!byId.has(key)) byId.set(key, element);
    }
  }
  return [...byId.values()];
}

async function queryOverpass(query: string): Promise<OverpassElement[] | null> {
  const responses = await Promise.all(OVERPASS_MIRRORS.map((mirror) => queryOverpassMirror(mirror, query)));
  if (!responses.some((result) => Array.isArray(result))) return null;
  return mergeOverpassResults(responses);
}

function splitArea(area: BoundingBox): BoundingBox[] {
  const south = Math.min(area.south, area.north);
  const north = Math.max(area.south, area.north);
  const west = Math.min(area.west, area.east);
  const east = Math.max(area.west, area.east);
  const height = north - south;
  const width = east - west;
  const maxSpan = 0.15;
  const rows = Math.max(1, Math.min(3, Math.ceil(height / maxSpan)));
  const cols = Math.max(1, Math.min(3, Math.ceil(width / maxSpan)));
  const tileHeight = height / rows || maxSpan;
  const tileWidth = width / cols || maxSpan;
  const tiles: BoundingBox[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      tiles.push({ south: south + row * tileHeight, north: row === rows - 1 ? north : south + (row + 1) * tileHeight, west: west + col * tileWidth, east: col === cols - 1 ? east : west + (col + 1) * tileWidth });
    }
  }
  return tiles;
}

async function queryArea(area: BoundingBox, categories: CategoryKey[]): Promise<OverpassElement[] | null> {
  const tiles = splitArea(area);
  const tileResults = await Promise.all(tiles.map((tile) => queryOverpass(buildOverpassQuery(tile, categories, false))));
  if (tileResults.every((result) => result === null)) return null;
  return mergeOverpassResults(tileResults);
}

export const searchPlacesServer = createServerFn({ method: "POST" })
  .validator((data: { q: string }) => data)
  .handler(async ({ data }): Promise<PlaceSuggestion[]> => {
    const q = data.q.trim().replace(/\s+/g, " ");
    if (q.length < 2) return [];
    const primary = await queryPlaces(q);
    const fallback = primary.length > 0 ? [] : await queryPlaces(`${q}, Brasil`);
    return dedupePlaces([...primary, ...fallback]).filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon))).slice(0, 8).map(toPlaceSuggestion);
  });

export const searchOverpassServer = createServerFn({ method: "POST" })
  .validator((data: { area: BoundingBox; categories: CategoryKey[]; signalZeroOnly?: boolean }) => data)
  .handler(async ({ data }): Promise<{ elements: OverpassElement[] }> => {
    const primary = await queryArea(data.area, data.categories);
    if (primary !== null && primary.length > 0) return { elements: primary };

    const centerLat = (data.area.south + data.area.north) / 2;
    const centerLon = (data.area.west + data.area.east) / 2;
    const fallback = await queryOverpass(buildAroundQuery(centerLat, centerLon, data.categories, 8000));
    if (fallback === null && primary === null) throw new Error("A fonte de estabelecimentos está indisponível no momento. Tente novamente em alguns segundos.");
    return { elements: mergeOverpassResults([primary ?? [], fallback ?? []]) };
  });

export const verifyLeadsServer = createServerFn({ method: "POST" })
  .validator((data: { leads: Establishment[] }) => data)
  .handler(async ({ data }): Promise<{ leads: (Establishment & { verification: LeadVerification })[]; external: boolean; healthy: boolean }> => {
    if (!externalVerificationConfigured()) {
      return { leads: data.leads.map((lead) => ({ ...lead, verification: { status: "unverified" as const, score: 0, reasons: ["Busca externa não configurada. Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX para validar presença digital."], checked: false, foundDigitalPresence: false, foundWebsite: false, contactConfidence: lead.contact.whatsappValid ? "high" : lead.contact.phoneDigits ? "medium" : "low" } })), external: false, healthy: false };
    }
    const verified = await verifyLeads(data.leads);
    const healthy = verified.length === 0 || verified.every((lead) => lead.verification.checked);
    return { leads: verified, external: true, healthy };
  });

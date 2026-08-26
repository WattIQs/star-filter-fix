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

type NominatimAddress = {
  city?: string;
  town?: string;
  municipality?: string;
  village?: string;
  suburb?: string;
  neighbourhood?: string;
  state?: string;
  country?: string;
  country_code?: string;
};

type NominatimResult = {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: NominatimAddress;
  boundingbox?: [string, string, string, string];
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toPlaceSuggestion(r: NominatimResult): PlaceSuggestion {
  const bb = r.boundingbox;
  const parts = r.display_name.split(",").map((p) => p.trim());
  const short = [r.name ?? parts[0], r.address?.state].filter(Boolean).join(", ");
  return {
    label: r.display_name,
    shortLabel: short || parts.slice(0, 3).join(", "),
    lat: Number.parseFloat(r.lat),
    lon: Number.parseFloat(r.lon),
    boundingBox:
      bb && bb.length >= 4
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

function cityName(result: NominatimResult): string {
  return normalizeText(
    result.address?.city ??
      result.address?.town ??
      result.address?.municipality ??
      result.address?.village ??
      result.name ??
      "",
  );
}

function matchScore(query: string, result: NominatimResult): number {
  const normalizedQuery = normalizeText(query);
  const city = cityName(result);
  const display = normalizeText(result.display_name);
  const state = normalizeText(result.address?.state);

  if (!normalizedQuery) return 0;
  if (city === normalizedQuery) return 100;
  if (city.startsWith(normalizedQuery)) return 90;
  if (display === normalizedQuery) return 85;
  if (display.startsWith(normalizedQuery)) return 78;
  if (display.includes(` ${normalizedQuery} `)) return 65;
  if (state === normalizedQuery) return 55;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const cityTokens = city.split(" ").filter(Boolean);
  const matched = queryTokens.filter((token) => cityTokens.some((candidate) => candidate.startsWith(token))).length;
  return queryTokens.length > 0 ? Math.round((matched / queryTokens.length) * 50) : 0;
}

async function queryPlaces(q: string): Promise<NominatimResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "10");
  url.searchParams.set("q", q);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("accept-language", "pt-BR");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("dedupe", "1");

  try {
    const response = await fetchWithTimeout(
      url.toString(),
      { headers: { Accept: "application/json", "User-Agent": OSM_UA } },
      8000,
    );
    if (!response.ok) return [];
    return (await response.json()) as NominatimResult[];
  } catch {
    return [];
  }
}

function rankPlaceResults(q: string, results: NominatimResult[]): NominatimResult[] {
  const deduped = dedupePlaces(results).filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)));
  return deduped
    .map((item, index) => ({ item, score: matchScore(q, item), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter(({ score }, index, all) => {
      if (index === 0) return true;
      const bestScore = all[0]?.score ?? 0;
      if (bestScore >= 90) return score >= 55;
      if (bestScore >= 75) return score >= 45;
      return score >= 25;
    })
    .map(({ item }) => item)
    .slice(0, 8);
}

async function queryOverpassMirror(mirror: string, query: string): Promise<OverpassElement[] | null> {
  try {
    const response = await fetchWithTimeout(
      mirror,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": OSM_UA,
        },
        body: `data=${encodeURIComponent(query)}`,
      },
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
      tiles.push({
        south: south + row * tileHeight,
        north: row === rows - 1 ? north : south + (row + 1) * tileHeight,
        west: west + col * tileWidth,
        east: col === cols - 1 ? east : west + (col + 1) * tileWidth,
      });
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

    const primary = rankPlaceResults(q, await queryPlaces(q));
    if (primary.length > 0) return primary.map(toPlaceSuggestion);

    const fallback = await queryPlaces(`${q}, Brasil`);
    return rankPlaceResults(q, fallback).map(toPlaceSuggestion);
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
      return {
        leads: data.leads.map((lead) => ({
          ...lead,
          verification: {
            status: "unverified" as const,
            score: 0,
            reasons: ["Busca externa não configurada. Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX para validar presença digital."],
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
    const verified = await verifyLeads(data.leads);
    const healthy = verified.length === 0 || verified.every((lead) => lead.verification.checked);
    return { leads: verified, external: true, healthy };
  });

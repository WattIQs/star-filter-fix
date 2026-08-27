import { createServerFn } from "@tanstack/react-start";
import type { BoundingBox, CategoryKey, Establishment } from "./types";
import { buildOverpassQuery } from "./overpass-query";
import { fetchWithTimeout, OSM_UA, OVERPASS_MIRRORS } from "./geo.server";
import { externalVerificationConfigured, verifyLeads, type LeadVerification } from "./web-verification";

export interface OverpassElement { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string>; }
export interface PlaceSuggestion { label: string; shortLabel: string; lat: number; lon: number; boundingBox: BoundingBox | null; }
type NominatimAddress = { city?: string; town?: string; municipality?: string; village?: string; state?: string; country?: string; country_code?: string };
type NominatimResult = { display_name: string; name?: string; lat: string; lon: string; type?: string; class?: string; address?: NominatimAddress; boundingbox?: [string, string, string, string] };

function normalizeText(v: string | null | undefined) { return (v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }

function toPlaceSuggestion(r: NominatimResult): PlaceSuggestion {
  const parts = r.display_name.split(",").map((p) => p.trim());
  const city = r.address?.city ?? r.address?.town ?? r.address?.municipality ?? r.address?.village ?? r.name ?? parts[0];
  const state = r.address?.state;
  const lat = Number(r.lat);
  const lon = Number(r.lon);
  const rawBox = r.boundingbox;
  const boundingBox = rawBox && rawBox.length === 4 ? {
    south: Number(rawBox[0]),
    north: Number(rawBox[1]),
    west: Number(rawBox[2]),
    east: Number(rawBox[3]),
  } : { south: lat - 0.025, north: lat + 0.025, west: lon - 0.03, east: lon + 0.03 };
  return { label: r.display_name, shortLabel: [city, state].filter(Boolean).join(", ") || parts.slice(0, 3).join(", "), lat, lon, boundingBox };
}

function placeName(r: NominatimResult) { return normalizeText(r.address?.city ?? r.address?.town ?? r.address?.municipality ?? r.address?.village ?? r.name ?? ""); }
function resultTypePriority(r: NominatimResult) { const type = normalizeText(r.type), cls = normalizeText(r.class); if (cls === "place" && ["city", "town", "municipality", "village"].includes(type)) return 300; if (cls === "boundary" && type === "administrative") return 260; if (type === "city" || type === "town") return 220; if (type === "suburb" || type === "neighbourhood") return 100; return 20; }
function matchScore(q: string, r: NominatimResult) { const name = normalizeText(r.name), city = placeName(r), display = normalizeText(r.display_name); let s = resultTypePriority(r); if (name === q) s += 300; else if (name.startsWith(q)) s += 180; else if (name.includes(q)) s += 80; if (city === q) s += 350; else if (city.startsWith(q)) s += 200; else if (city.includes(q)) s += 100; if (display.startsWith(`${q},`)) s += 120; const ts = q.split(" ").filter(Boolean); if (ts.length) s += Math.round(ts.filter((t) => [name, city, display].some((h) => h.split(" ").some((x) => x === t))).length / ts.length * 100); return s; }
function rankPlaceResults(q: string, rs: NominatimResult[]) { const qn = normalizeText(q), seen = new Set<string>(); return rs.filter((r) => !r.address?.country_code || r.address.country_code.toLowerCase() === "br").filter((r) => { const k = `${Number(r.lat).toFixed(5)}:${Number(r.lon).toFixed(5)}`; if (seen.has(k)) return false; seen.add(k); return true; }).map((item, index) => ({ item, score: matchScore(qn, item), index })).sort((a, b) => b.score - a.score || a.index - b.index).filter((x) => x.score >= 100).slice(0, 8).map((x) => x.item); }

async function queryPlaces(q: string): Promise<NominatimResult[]> {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  const params: Array<[string, string]> = [
    ["format", "jsonv2"], ["limit", "20"], ["q", q], ["countrycodes", "br"],
    ["accept-language", "pt-BR"], ["addressdetails", "1"], ["namedetails", "1"], ["dedupe", "1"],
  ];
  for (const [k, v] of params) u.searchParams.set(k, v);
  try { const r = await fetchWithTimeout(u.toString(), { headers: { Accept: "application/json", "User-Agent": OSM_UA } }, 8000); if (!r.ok) return []; return await r.json() as NominatimResult[]; } catch { return []; }
}

async function queryOverpassMirror(m: string, q: string): Promise<OverpassElement[] | null> {
  try { const r = await fetchWithTimeout(m, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": OSM_UA }, body: `data=${encodeURIComponent(q)}` }, 13000); if (!r.ok) return null; const j = await r.json() as { elements?: OverpassElement[] }; return j.elements ?? []; } catch { return null; }
}
function merge(responses: Array<OverpassElement[] | null>) { const m = new Map<string, OverpassElement>(); for (const rs of responses) for (const e of rs ?? []) { const k = `${e.type}-${e.id}`; if (!m.has(k)) m.set(k, e); } return [...m.values()]; }
async function queryOverpass(q: string) { const rs = await Promise.all(OVERPASS_MIRRORS.map((m) => queryOverpassMirror(m, q))); if (!rs.some(Boolean)) return null; return merge(rs); }
function splitArea(a: BoundingBox) { const s = Math.min(a.south, a.north), n = Math.max(a.south, a.north), w = Math.min(a.west, a.east), e = Math.max(a.west, a.east), dh = (n - s) / 2, dw = (e - w) / 2; return [0, 1, 2, 3].map((i) => { const row = Math.floor(i / 2), col = i % 2; return { south: s + row * dh, north: row === 1 ? n : s + (row + 1) * dh, west: w + col * dw, east: col === 1 ? e : w + (col + 1) * dw }; }); }
async function queryArea(a: BoundingBox, c: CategoryKey[]) { const rs = await Promise.all(splitArea(a).map((t) => queryOverpass(buildOverpassQuery(t, c, false)))); if (rs.every((x) => x === null)) return null; return merge(rs); }

export const searchPlacesServer = createServerFn({ method: "POST" }).validator((data: { q: string }) => data).handler(async ({ data }): Promise<PlaceSuggestion[]> => {
  const q = data.q.trim().replace(/\s+/g, " ");
  if (q.length < 2) return [];
  const ranked = rankPlaceResults(q, await queryPlaces(q));
  return ranked.map(toPlaceSuggestion);
});

export const searchOverpassServer = createServerFn({ method: "POST" }).validator((data: { area: BoundingBox; categories: CategoryKey[] }) => data).handler(async ({ data }) => {
  const primary = await queryArea(data.area, data.categories);
  if (primary === null) throw new Error("A fonte de estabelecimentos está indisponível no momento. Tente novamente em alguns segundos.");
  return { elements: primary };
});

export const verifyLeadsServer = createServerFn({ method: "POST" }).validator((data: { leads: Establishment[] }) => data).handler(async ({ data }): Promise<{ leads: (Establishment & { verification: LeadVerification })[]; external: boolean }> => {
  if (!externalVerificationConfigured()) return { leads: data.leads.map((lead) => ({ ...lead, verification: { status: "unverified", score: 0, reasons: ["Verificação externa não configurada; usados os dados do OpenStreetMap."], checked: false, foundDigitalPresence: Boolean(lead.signals.website || lead.signals.instagram || lead.contact.whatsappValid || lead.contact.instagramUrl), foundWebsite: Boolean(lead.signals.website || lead.contact.websiteUrl), contactConfidence: "low" as const } })), external: false };
  return { leads: await verifyLeads(data.leads), external: true };
});

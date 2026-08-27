import { createServerFn } from "@tanstack/react-start";
import { fetchWithTimeout, OSM_UA } from "./geo.server";
import type { PlaceSuggestion } from "./geo.functions";

interface IBGEMunicipality {
  id: number;
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
  "regiao-imediata"?: { "regiao-intermediaria"?: { UF?: { sigla?: string } } };
}

export interface MunicipalitySuggestion {
  kind: "municipality";
  id: number;
  name: string;
  uf: string;
  label: string;
  shortLabel: string;
}

type NominatimPlace = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: { city?: string; town?: string; municipality?: string; village?: string; state?: string; country_code?: string };
  boundingbox?: [string, string, string, string];
  type?: string;
  class?: string;
};

let municipalityCache: { expiresAt: number; items: IBGEMunicipality[] } | null = null;
let municipalityRequest: Promise<IBGEMunicipality[]> | null = null;

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  const curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j] ?? j;
  }
  return prev[b.length] ?? Math.max(a.length, b.length);
}

function fuzzyLimit(query: string) {
  const length = query.replace(/\s+/g, "").length;
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  return 3;
}

function municipalityUF(item: IBGEMunicipality) {
  return item.microrregiao?.mesorregiao?.UF?.sigla
    ?? item["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla
    ?? "";
}

async function loadMunicipalities(): Promise<IBGEMunicipality[]> {
  const now = Date.now();
  if (municipalityCache && municipalityCache.expiresAt > now) return municipalityCache.items;
  if (municipalityRequest) return municipalityRequest;

  municipalityRequest = (async () => {
    const response = await fetchWithTimeout(
      "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
      { headers: { Accept: "application/json" } },
      12000,
    );
    if (!response.ok) throw new Error(`IBGE respondeu com status ${response.status}.`);
    const data = await response.json() as IBGEMunicipality[];
    const items = data.filter((item) => item?.id && item?.nome);
    municipalityCache = { expiresAt: now + 24 * 60 * 60 * 1000, items };
    return items;
  })().finally(() => {
    municipalityRequest = null;
  });

  return municipalityRequest;
}

function rankMunicipalities(query: string, municipalities: IBGEMunicipality[]): MunicipalitySuggestion[] {
  const q = normalizeText(query);
  const compactQuery = q.replace(/\s+/g, "");
  const limit = fuzzyLimit(q);

  return municipalities
    .map((item) => {
      const name = normalizeText(item.nome);
      const compactName = name.replace(/\s+/g, "");
      let priority = 0;
      if (name === q) priority = 1000;
      else if (name.startsWith(q)) priority = 850;
      else if (compactName.startsWith(compactQuery)) priority = 820;
      else if (name.includes(q)) priority = 600;
      const distance = editDistance(compactQuery, compactName);
      return { item, name, priority, distance };
    })
    .filter((entry) => entry.priority > 0 || entry.distance <= limit)
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.name.localeCompare(b.name, "pt-BR");
    })
    .slice(0, 8)
    .map(({ item }) => {
      const uf = municipalityUF(item);
      return {
        kind: "municipality" as const,
        id: item.id,
        name: item.nome,
        uf,
        shortLabel: [item.nome, uf].filter(Boolean).join(", "),
        label: [item.nome, uf, "Brasil"].filter(Boolean).join(", "),
      };
    });
}

export const searchMunicipalitiesServer = createServerFn({ method: "POST" })
  .validator((data: { q: string }) => data)
  .handler(async ({ data }): Promise<MunicipalitySuggestion[]> => {
    const q = data.q.trim();
    if (q.length < 2) return [];
    try {
      const municipalities = await loadMunicipalities();
      return rankMunicipalities(q, municipalities);
    } catch {
      return [];
    }
  });

function toPlaceSuggestion(result: NominatimPlace, fallback: MunicipalitySuggestion): PlaceSuggestion | null {
  const lat = Number(result.lat);
  const lon = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const box = result.boundingbox;
  const boundingBox = box && box.length === 4
    ? { south: Number(box[0]), north: Number(box[1]), west: Number(box[2]), east: Number(box[3]) }
    : { south: lat - 0.03, north: lat + 0.03, west: lon - 0.03, east: lon + 0.03 };

  return {
    label: result.display_name ?? fallback.label,
    shortLabel: [fallback.name, fallback.uf].filter(Boolean).join(", "),
    lat,
    lon,
    boundingBox,
  };
}

export const resolveMunicipalityServer = createServerFn({ method: "POST" })
  .validator((data: { name: string; uf: string }) => data)
  .handler(async ({ data }): Promise<PlaceSuggestion | null> => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${data.name}, ${data.uf}, Brasil`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "3");
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("featureType", "city");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "pt-BR");

    try {
      const response = await fetchWithTimeout(
        url.toString(),
        { headers: { Accept: "application/json", "User-Agent": OSM_UA } },
        8000,
      );
      if (!response.ok) return null;
      const results = await response.json() as NominatimPlace[];
      const normalizedName = normalizeText(data.name);
      const best = results
        .filter((result) => result.address?.country_code?.toLowerCase() === "br" || !result.address?.country_code)
        .sort((a, b) => {
          const aCity = normalizeText(a.address?.city ?? a.address?.town ?? a.address?.municipality ?? a.address?.village);
          const bCity = normalizeText(b.address?.city ?? b.address?.town ?? b.address?.municipality ?? b.address?.village);
          return Number(bCity === normalizedName) - Number(aCity === normalizedName);
        })[0];
      if (!best) return null;
      return toPlaceSuggestion(best, {
        kind: "municipality",
        id: 0,
        name: data.name,
        uf: data.uf,
        label: `${data.name}, ${data.uf}, Brasil`,
        shortLabel: `${data.name}, ${data.uf}`,
      });
    } catch {
      return null;
    }
  });

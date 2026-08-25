import { createServerFn } from "@tanstack/react-start";
import type { BoundingBox, CategoryKey } from "./types";
import { buildOverpassQuery } from "./overpass-query";
import { fetchWithTimeout, OSM_UA, OVERPASS_MIRRORS } from "./geo.server";

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

/** Busca livre: país, estado, cidade, bairro, rua ou ponto de referência. */
export const searchPlacesServer = createServerFn({ method: "POST" })
  .validator((data: { q: string }) => data)
  .handler(async ({ data }): Promise<PlaceSuggestion[]> => {
    const q = data.q.trim();
    if (q.length < 3) return [];

    const response = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json", "User-Agent": OSM_UA } },
      12000,
    );
    if (!response.ok) {
      throw new Error(`Busca de lugares indisponível agora (código ${response.status}). Tente novamente.`);
    }

    const results = (await response.json()) as {
      display_name: string;
      lat: string;
      lon: string;
      boundingbox?: [string, string, string, string];
    }[];

    return results.map((r) => {
      const bb = r.boundingbox;
      const parts = r.display_name.split(",").map((p) => p.trim());
      return {
        label: r.display_name,
        shortLabel: parts.slice(0, 3).join(", "),
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
    });
  });

export const searchOverpassServer = createServerFn({ method: "POST" })
  .validator((data: { area: BoundingBox; categories: CategoryKey[] }) => data)
  .handler(async ({ data }): Promise<{ elements: OverpassElement[] }> => {
    const query = buildOverpassQuery(data.area, data.categories);
    const errors: string[] = [];

    // Tenta os mirrors em sequência, mas falha rápido para que uma API congestionada
    // não deixe a interface presa por quase um minuto.
    for (const mirror of OVERPASS_MIRRORS) {
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
          18000,
        );
        if (!response.ok) {
          errors.push(`${new URL(mirror).hostname}: ${response.status}`);
          continue;
        }
        const json = (await response.json()) as { elements?: OverpassElement[] };
        return { elements: json.elements ?? [] };
      } catch (error) {
        errors.push(`${new URL(mirror).hostname}: ${(error as Error).message}`);
      }
    }

    throw new Error(
      "Não foi possível concluir a varredura agora. O OpenStreetMap está demorando para responder; tente novamente em alguns segundos.",
    );
  });

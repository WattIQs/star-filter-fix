import { createServerFn } from "@tanstack/react-start";
import type { BoundingBox, CategoryKey, Establishment } from "./types";
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
  .validator((data: { area: BoundingBox; categories: CategoryKey[]; signalZeroOnly?: boolean }) => data)
  .handler(async ({ data }): Promise<{ elements: OverpassElement[] }> => {
    const query = buildOverpassQuery(data.area, data.categories, data.signalZeroOnly === true);
    const errors: string[] = [];

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
            score: 50,
            reasons: ["Verificação externa não configurada."],
            checked: false,
            foundDigitalPresence: false,
            contactConfidence: lead.contact.whatsappValid ? "high" : lead.contact.phoneDigits ? "medium" : "low",
          },
        })),
        external: false,
        healthy: false,
      };
    }

    const candidates = data.leads.slice(0, 40);
    const verified = await verifyLeads(candidates);
    const healthy = verified.some((lead) => lead.verification.checked);

    return { leads: verified, external: true, healthy };
  });

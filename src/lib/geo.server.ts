import type { OverpassElement } from "./geo.functions";

export const OSM_UA = "SinalZeroLeadScanner/1.0 (lead prospecting tool)";

export const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

// Public Overpass instances can take several seconds for broad city scans.
// Keep the per-mirror timeout high enough to avoid declaring a healthy mirror
// dead while still guaranteeing that a failed mirror cannot block the scan.
const OVERPASS_REQUEST_TIMEOUT_MS = 25000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 60000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function queryOverpass(query: string): Promise<OverpassElement[] | null> {
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
        OVERPASS_REQUEST_TIMEOUT_MS
      );
      if (!response.ok) continue;
      const json = (await response.json()) as { elements?: OverpassElement[] };
      return json.elements ?? [];
    } catch {
      // Try the next Overpass mirror.
    }
  }
  return null;
}

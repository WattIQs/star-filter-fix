import type { BoundingBox, CategoryKey } from "./types";
import { CATEGORIES } from "./types";

function escapeRegex(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

const SUPPORTED_BY_KEY: Record<string, string[]> = {
  amenity: ["restaurant", "fast_food", "cafe", "bar", "pub", "pharmacy"],
  shop: [
    "bakery", "pastry", "hairdresser", "barber", "beauty", "massage", "tattoo", "cosmetics", "perfumery", "chemist",
    "pet", "pet_grooming", "supermarket", "greengrocer", "butcher", "convenience", "kiosk", "general", "clothes", "shoes",
    "boutique", "jewelry", "hardware", "doityourself", "paint", "florist",
  ],
  leisure: ["fitness_centre"],
};

function blocksForValues(area: string, key: string, values: string[]): string {
  const pattern = values.map(escapeRegex).join("|");
  return `nwr["${key}"~"^(${pattern})$"]["name"](${area});`;
}

function generalBlocks(area: string): string[] {
  return Object.entries(SUPPORTED_BY_KEY).map(([key, values]) => blocksForValues(area, key, values));
}

function categoryBlocks(area: string, categories: CategoryKey[]): string[] {
  const groups = new Map<string, Set<string>>();
  for (const category of categories) {
    for (const filter of CATEGORIES[category].filters) {
      const values = groups.get(filter.key) ?? new Set<string>();
      for (const value of filter.values) values.add(value);
      groups.set(filter.key, values);
    }
  }

  const blocks: string[] = [];
  for (const [key, values] of groups) {
    if (values.size === 0) continue;
    blocks.push(blocksForValues(area, key, [...values]));
  }
  return blocks.length > 0 ? blocks : generalBlocks(area);
}

function buildQuery(area: string, categories: CategoryKey[]): string {
  const blocks = categories.length > 0 ? categoryBlocks(area, categories) : generalBlocks(area);
  return `[out:json][timeout:20];\n(\n${blocks.join("\n")}\n);\nout center tags;`;
}

export function buildOverpassQuery(area: BoundingBox, categories: CategoryKey[], _signalZeroOnly = false): string {
  const bbox = `${area.south},${area.west},${area.north},${area.east}`;
  return buildQuery(bbox, categories);
}

export function buildAroundQuery(lat: number, lon: number, categories: CategoryKey[], radiusMeters = 8000): string {
  return buildQuery(`around:${radiusMeters},${lat},${lon}`, categories);
}

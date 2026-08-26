import type { BoundingBox, CategoryKey } from "./types";
import { CATEGORIES } from "./types";

function escapeRegex(values: string[]): string {
  return values.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
}

function categoryBlocks(categories: CategoryKey[], area: string): string[] {
  const blocks: string[] = [];
  for (const category of categories) {
    for (const filter of CATEGORIES[category]?.filters ?? []) {
      const values = escapeRegex(filter.values);
      if (!values) continue;
      // Do not require `name` at the API level. OSM can store a valid business
      // without a name tag; the application can discard truly unusable rows
      // after it receives the objects.
      blocks.push(`nwr["${filter.key}"~"^(${values})$"](${area});`);
    }
  }
  return blocks;
}

function generalBlocks(area: string): string[] {
  return [
    `nwr["amenity"]["name"](${area});`,
    `nwr["shop"]["name"](${area});`,
    `nwr["leisure"]["name"](${area});`,
  ];
}

export function buildOverpassQuery(area: BoundingBox, categories: CategoryKey[], signalZeroOnly = false): string {
  void signalZeroOnly;
  const bbox = `${area.south},${area.west},${area.north},${area.east}`;
  const blocks = categories.length > 0 ? categoryBlocks(categories, bbox) : generalBlocks(bbox);
  const safeBlocks = blocks.length > 0 ? blocks : generalBlocks(bbox);
  return `[out:json][timeout:6];\n(\n${safeBlocks.join("\n")}\n);\nout center tags;`;
}

export function buildAroundQuery(lat: number, lon: number, categories: CategoryKey[], radiusMeters = 5000): string {
  const area = `around:${radiusMeters},${lat},${lon}`;
  const blocks = categories.length > 0 ? categoryBlocks(categories, area) : generalBlocks(area);
  const safeBlocks = blocks.length > 0 ? blocks : generalBlocks(area);
  return `[out:json][timeout:6];\n(\n${safeBlocks.join("\n")}\n);\nout center tags;`;
}

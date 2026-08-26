import type { BoundingBox, CategoryKey } from "./types";

function generalBlocks(area: string): string[] {
  return [
    `nwr["amenity"]["name"](${area});`,
    `nwr["shop"]["name"](${area});`,
    `nwr["leisure"]["name"](${area});`,
  ];
}

function buildQuery(area: string): string {
  return `[out:json][timeout:12];\n(\n${generalBlocks(area).join("\n")}\n);\nout center tags;`;
}

export function buildOverpassQuery(area: BoundingBox, _categories: CategoryKey[], _signalZeroOnly = false): string {
  const bbox = `${area.south},${area.west},${area.north},${area.east}`;
  return buildQuery(bbox);
}

export function buildAroundQuery(lat: number, lon: number, _categories: CategoryKey[], radiusMeters = 8000): string {
  return buildQuery(`around:${radiusMeters},${lat},${lon}`);
}

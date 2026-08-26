import type { BoundingBox, CategoryKey } from "./types";
import { CATEGORIES } from "./types";

export function buildOverpassQuery(area: BoundingBox, categories: CategoryKey[], signalZeroOnly = false): string {
  const bbox = `${area.south},${area.west},${area.north},${area.east}`;
  void signalZeroOnly;

  const filters: string[] = [];
  for (const category of categories) {
    for (const filter of CATEGORIES[category]?.filters ?? []) {
      const values = filter.values
        .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      if (values) filters.push(`nwr["${filter.key}"~"^(?:${values})$"]["name"](${bbox});`);
    }
  }

  const queryBlocks = filters.length > 0
    ? filters.join("\n")
    : [
        `nwr["name"]["amenity"](${bbox});`,
        `nwr["name"]["shop"](${bbox});`,
        `nwr["name"]["leisure"](${bbox});`,
      ].join("\n");

  return `[out:json][timeout:10];\n(\n${queryBlocks}\n);\nout center tags;`;
}

export function buildAroundQuery(lat: number, lon: number, categories: CategoryKey[], radiusMeters = 5000): string {
  const filters: string[] = [];
  for (const category of categories) {
    for (const filter of CATEGORIES[category]?.filters ?? []) {
      const values = filter.values
        .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      if (values) filters.push(`nwr["${filter.key}"~"^(?:${values})$"]["name"](around:${radiusMeters},${lat},${lon});`);
    }
  }

  const queryBlocks = filters.length > 0
    ? filters.join("\n")
    : [
        `nwr["name"]["amenity"](around:${radiusMeters},${lat},${lon});`,
        `nwr["name"]["shop"](around:${radiusMeters},${lat},${lon});`,
        `nwr["name"]["leisure"](around:${radiusMeters},${lat},${lon});`,
      ].join("\n");

  return `[out:json][timeout:8];\n(\n${queryBlocks}\n);\nout center tags;`;
}

import type { BoundingBox, CategoryKey } from "./types";
import { CATEGORIES } from "./types";

/** Monta uma query Overpass compacta para reduzir tempo e payload. */
export function buildOverpassQuery(area: BoundingBox, categories: CategoryKey[]): string {
  const byKey = new Map<string, Set<string>>();
  for (const key of categories) {
    for (const filter of CATEGORIES[key]?.filters ?? []) {
      const set = byKey.get(filter.key) ?? new Set<string>();
      filter.values.forEach((v) => set.add(v));
      byKey.set(filter.key, set);
    }
  }

  const bbox = `${area.south},${area.west},${area.north},${area.east}`;
  const blocks: string[] = [];
  for (const [key, values] of byKey) {
    const escaped = [...values].map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const filter = `["${key}"~"^(${escaped})$"]`;
    blocks.push(`node${filter}(${bbox});`);
    blocks.push(`way${filter}(${bbox});`);
  }

  return `[out:json][timeout:18];\n(\n${blocks.join("\n")}\n);\nout tags center 1000;`;
}

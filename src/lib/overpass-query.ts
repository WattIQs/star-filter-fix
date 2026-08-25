import type { BoundingBox, CategoryKey } from "./types";
import { CATEGORIES } from "./types";

/**
 * Monta uma query Overpass agrupando os valores OSM por chave
 * (amenity / shop / leisure), de modo que qualquer categoria — de
 * restaurante a pet shop — caiba na mesma varredura.
 */
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
    const filter = `["${key}"~"^(${[...values].join("|")})$"]`;
    blocks.push(`  node${filter}(${bbox});`);
    blocks.push(`  way${filter}(${bbox});`);
  }

  return `[out:json][timeout:50];
(
${blocks.join("\n")}
);
out tags center 1500;`;
}

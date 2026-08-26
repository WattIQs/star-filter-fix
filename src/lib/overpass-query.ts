import type { BoundingBox, CategoryKey } from "./types";
import { CATEGORIES } from "./types";

/**
 * Monta a query Overpass. O modo normal e o modo Sinal Zero partem da mesma
 * base de estabelecimentos. A decisão de Sinal Zero é feita depois, no
 * classificador local + verificação web. Isso evita eliminar candidatos
 * válidos só porque o OSM não possui todos os campos de presença digital.
 */
export function buildOverpassQuery(area: BoundingBox, categories: CategoryKey[], signalZeroOnly = false): string {
  const byKey = new Map<string, Set<string>>();
  for (const key of categories) {
    for (const filter of CATEGORIES[key]?.filters ?? []) {
      const set = byKey.get(filter.key) ?? new Set<string>();
      filter.values.forEach((v) => set.add(v));
      byKey.set(filter.key, set);
    }
  }

  if (byKey.size === 0) return "[out:json][timeout:12];\n(\n);\nout tags center 1;";

  const bbox = `${area.south},${area.west},${area.north},${area.east}`;
  const blocks: string[] = [];

  for (const [key, values] of byKey) {
    const escaped = [...values]
      .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const filter = `["${key}"~"^(${escaped})$"]`;
    blocks.push(`node${filter}(${bbox});`);
    blocks.push(`way${filter}(${bbox});`);
  }

  // signalZeroOnly is intentionally not encoded as a strict OSM predicate.
  // Missing OSM tags do not prove absence of a real-world website/social
  // profile, so candidates must survive the local quality gate and web
  // verification in the application layer.
  const outputLimit = signalZeroOnly ? 1000 : 1200;
  return `[out:json][timeout:12];\n(\n${blocks.join("\n")}\n);\nout tags center ${outputLimit};`;
}

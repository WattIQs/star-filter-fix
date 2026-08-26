import type { BoundingBox, CategoryKey } from "./types";
import { CATEGORIES } from "./types";

/**
 * Monta a query Overpass. O modo normal e o modo Sinal Zero partem da mesma
 * base de estabelecimentos. A decisão de Sinal Zero é feita depois, no
 * classificador local + verificação web.
 */
export function buildOverpassQuery(area: BoundingBox, categories: CategoryKey[], signalZeroOnly = false): string {
  const bbox = `${area.south},${area.west},${area.north},${area.east}`;

  // Sem categoria selecionada, ainda devemos conseguir varrer a área.
  // Busca estabelecimentos nomeados por tags comerciais comuns e deixa o
  // classificador local decidir o tipo e os sinais.
  if (categories.length === 0) {
    return `[out:json][timeout:15];\n(\nnwr["name"]["amenity"](${bbox});\nnwr["name"]["shop"](${bbox});\nnwr["name"]["leisure"](${bbox});\n);\nout tags center ${signalZeroOnly ? 1600 : 2000};`;
  }

  const byKey = new Map<string, Set<string>>();
  for (const key of categories) {
    for (const filter of CATEGORIES[key]?.filters ?? []) {
      const set = byKey.get(filter.key) ?? new Set<string>();
      filter.values.forEach((v) => set.add(v));
      byKey.set(filter.key, set);
    }
  }

  if (byKey.size === 0) return `[out:json][timeout:15];\n(\n);\nout tags center 1;`;

  const blocks: string[] = [];
  for (const [key, values] of byKey) {
    const escaped = [...values]
      .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const filter = `["${key}"~"^(${escaped})$"]`;
    blocks.push(`node${filter}(${bbox});`);
    blocks.push(`way${filter}(${bbox});`);
    blocks.push(`relation${filter}(${bbox});`);
  }

  const outputLimit = signalZeroOnly ? 1400 : 1800;
  return `[out:json][timeout:15];\n(\n${blocks.join("\n")}\n);\nout tags center ${outputLimit};`;
}

import type { BoundingBox, CategoryKey } from "./types";
import { CATEGORIES } from "./types";

/**
 * Monta a query Overpass. Por padrão, busca todos os estabelecimentos das
 * categorias escolhidas. O filtro Sinal Zero é aplicado depois, quando o
 * usuário o ativa, para não limitar a descoberta de leads.
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

  const noCommercialDigital = [
    "website", "contact:website", "url", "contact:url",
    "instagram", "contact:instagram", "facebook", "contact:facebook",
    "twitter", "contact:twitter", "x", "contact:x",
    "tiktok", "contact:tiktok", "youtube", "contact:youtube",
    "linkedin", "contact:linkedin", "email", "contact:email",
  ];

  // Só restringe a query no modo Sinal Zero. No modo normal precisamos
  // preservar também os leads que já possuem presença digital.
  const zeroFilters = signalZeroOnly
    ? noCommercialDigital.map((key) => `["${key}"!~".+"]`).join("")
    : "";

  for (const [key, values] of byKey) {
    const escaped = [...values]
      .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const filter = `["${key}"~"^(${escaped})$"]${zeroFilters}`;
    blocks.push(`node${filter}(${bbox});`);
    blocks.push(`way${filter}(${bbox});`);
  }

  return `[out:json][timeout:12];\n(\n${blocks.join("\n")}\n);\nout tags center 600;`;
}

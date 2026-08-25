import type { BoundingBox, CategoryKey } from "./types";
import { CATEGORIES } from "./types";

/**
 * Monta uma query Overpass focada em candidatos Sinal Zero.
 *
 * A própria consulta já elimina objetos que possuem sinais comerciais de
 * presença digital no OSM. Isso reduz payload, tempo de processamento e,
 * principalmente, falsos positivos antes mesmo da classificação no cliente.
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

  if (byKey.size === 0) return "[out:json][timeout:12];\n(\n);\nout tags center 1;";

  const bbox = `${area.south},${area.west},${area.north},${area.east}`;
  const blocks: string[] = [];

  // Esses campos representam presença digital comercial. Telefone/WhatsApp
  // NÃO é excluído: ele é justamente o canal de prospecção que queremos.
  const noCommercialDigital = [
    "website",
    "contact:website",
    "url",
    "contact:url",
    "instagram",
    "contact:instagram",
    "facebook",
    "contact:facebook",
    "twitter",
    "contact:twitter",
    "x",
    "contact:x",
    "tiktok",
    "contact:tiktok",
    "youtube",
    "contact:youtube",
    "linkedin",
    "contact:linkedin",
    "email",
    "contact:email",
  ];

  const zeroFilters = noCommercialDigital
    .map((key) => `["${key}"!~".+"]`)
    .join("");

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

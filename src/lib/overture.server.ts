import type { BoundingBox } from "./types";
import type { OverpassElement } from "./geo.functions";

const DEFAULT_RELEASE = "2026-08-19.0";
const MAX_RESULTS = 3000;
const OVERTURE_TIMEOUT_MS = 12000;
const MAX_OVERTURE_AREA_DEG2 = 0.5;

type OvertureRow = {
  id?: string;
  name?: string;
  basic_category?: string;
  taxonomy_primary?: string;
  taxonomy_hierarchy?: string[];
  latitude?: number;
  longitude?: number;
  website?: string;
  social?: string;
  email?: string;
  phone?: string;
  address?: string;
  locality?: string;
  region?: string;
  postcode?: string;
  operating_status?: string;
  confidence?: number;
  brand?: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hashId(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) || 1;
}

function firstUrl(value: unknown): string {
  if (Array.isArray(value)) return clean(value[0]);
  return clean(value);
}

/**
 * Overture taxonomy is free-form. Matching by substring is dangerous:
 * "barbearia" contains "bar" and was therefore previously classified as a bar.
 * Match taxonomy tokens instead, while still accepting compound values such as
 * "wine_bar" and "hair_salon".
 */
function taxonomyTokens(values: string[]): Set<string> {
  const tokens = new Set<string>();
  for (const value of values) {
    const normalized = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (!normalized) continue;
    tokens.add(normalized);
    for (const token of normalized.split(" ")) if (token) tokens.add(token);
  }
  return tokens;
}

function categoryTags(row: OvertureRow): Record<string, string> {
  const values = [clean(row.basic_category), clean(row.taxonomy_primary), ...(Array.isArray(row.taxonomy_hierarchy) ? row.taxonomy_hierarchy.map(clean) : [])].filter(Boolean);
  const tokens = taxonomyTokens(values);
  const has = (...needles: string[]) => needles.some((needle) => tokens.has(needle));

  // More specific categories must win before generic ones.
  if (has("barber", "barbershop", "barbers", "barbearia")) return { shop: "barber" };
  if (has("hair_salon", "hairdresser", "hairdressers", "salon", "salao")) return { shop: "hairdresser" };
  if (has("fast_food", "fast_food_restaurant", "burger", "hamburger")) return { amenity: "fast_food" };
  if (has("restaurant", "restaurants", "dining", "eatery")) return { amenity: "restaurant" };
  if (has("coffee", "cafe", "cafeteria")) return { amenity: "cafe" };
  if (has("pub", "pubs")) return { amenity: "pub" };
  if (has("bar", "bars", "wine_bar", "cocktail_bar")) return { amenity: "bar" };
  if (has("pharmacy", "drugstore")) return { amenity: "pharmacy" };
  if (has("bakery", "pastry")) return { shop: "bakery" };
  if (has("beauty_salon", "beauty")) return { shop: "beauty" };
  if (has("cosmetics", "perfumery")) return { shop: "cosmetics" };
  if (has("pet_store", "pet")) return { shop: "pet" };
  if (has("supermarket")) return { shop: "supermarket" };
  if (has("convenience", "grocery")) return { shop: "convenience" };
  if (has("clothing", "clothes", "shoe_store")) return { shop: "clothes" };
  if (has("hardware", "home_improvement")) return { shop: "hardware" };
  if (has("fitness", "gym")) return { leisure: "fitness_centre" };
  return {};
}

function normalizeArea(area: BoundingBox): BoundingBox | null {
  const south = Number(area.south);
  const north = Number(area.north);
  const west = Number(area.west);
  const east = Number(area.east);
  if (![south, north, west, east].every(Number.isFinite)) return null;
  if (south < -90 || north > 90 || west < -180 || east > 180 || south > north || west > east) return null;
  return { south, north, west, east };
}

function areaSizeDeg2(area: BoundingBox): number {
  return Math.abs((area.north - area.south) * (area.east - area.west));
}

export async function queryOverturePlaces(area: BoundingBox): Promise<OverpassElement[]> {
  const bounds = normalizeArea(area);
  if (!bounds || areaSizeDeg2(bounds) > MAX_OVERTURE_AREA_DEG2) return [];

  const { DuckDBInstance } = await import("@duckdb/node-api");
  const release = process.env.OVERTURE_RELEASE?.trim() || DEFAULT_RELEASE;
  const path = `s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*`;
  const south = bounds.south;
  const north = bounds.north;
  const west = bounds.west;
  const east = bounds.east;

  const instance = await DuckDBInstance.create(":memory:", { threads: "2", max_memory: "512MB" });
  const connection = await instance.connect();

  try {
    await connection.run("INSTALL httpfs; LOAD httpfs;");
    await connection.run("SET s3_region='us-west-2'; SET s3_use_ssl=true; SET enable_object_cache=true;");

    const sql = `
      SELECT
        CAST(id AS VARCHAR) AS id,
        names.primary AS name,
        basic_category,
        taxonomy.primary AS taxonomy_primary,
        taxonomy.hierarchy AS taxonomy_hierarchy,
        bbox.ymin AS latitude,
        bbox.xmin AS longitude,
        websites[1] AS website,
        socials[1] AS social,
        emails[1] AS email,
        phones[1] AS phone,
        addresses[1].freeform AS address,
        addresses[1].locality AS locality,
        addresses[1].region AS region,
        addresses[1].postcode AS postcode,
        operating_status,
        confidence,
        brand.names.primary AS brand
      FROM read_parquet('${path}', hive_partitioning=1)
      WHERE bbox.xmax >= ${west}
        AND bbox.xmin <= ${east}
        AND bbox.ymax >= ${south}
        AND bbox.ymin <= ${north}
        AND (operating_status IS NULL OR operating_status <> 'permanently_closed')
        AND (confidence IS NULL OR confidence > 0.2)
      LIMIT ${MAX_RESULTS};
    `;

    const reader = await connection.runAndReadAll(sql);
    const rows = reader.getRowObjectsJson() as OvertureRow[];
    return rows
      .filter((row) => clean(row.name) && Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)))
      .map((row) => {
        const idText = clean(row.id) || `${row.name}:${row.latitude}:${row.longitude}`;
        const tags: Record<string, string> = { name: clean(row.name), ...categoryTags(row) };
        const website = firstUrl(row.website);
        const social = firstUrl(row.social);
        const email = firstUrl(row.email);
        const phone = firstUrl(row.phone);
        if (website) tags.website = website;
        if (/instagram\.com/i.test(social)) tags["contact:instagram"] = social;
        else if (/facebook\.com/i.test(social)) tags["contact:facebook"] = social;
        else if (social) tags["contact:social"] = social;
        if (email) tags.email = email;
        if (phone) tags.phone = phone;
        if (clean(row.address)) tags["addr:street"] = clean(row.address);
        if (clean(row.locality)) tags["addr:city"] = clean(row.locality);
        if (clean(row.region)) tags["addr:state"] = clean(row.region);
        if (clean(row.postcode)) tags["addr:postcode"] = clean(row.postcode);
        if (clean(row.brand)) tags.brand = clean(row.brand);
        return { type: "overture", id: hashId(idText), lat: Number(row.latitude), lon: Number(row.longitude), tags } satisfies OverpassElement;
      });
  } finally {
    connection.disconnectSync();
  }
}

export async function safeQueryOverturePlaces(area: BoundingBox): Promise<OverpassElement[]> {
  const bounds = normalizeArea(area);
  if (!bounds || areaSizeDeg2(bounds) > MAX_OVERTURE_AREA_DEG2) return [];
  try {
    return await Promise.race([
      queryOverturePlaces(bounds),
      new Promise<OverpassElement[]>((resolve) => setTimeout(() => resolve([]), OVERTURE_TIMEOUT_MS)),
    ]);
  } catch {
    return [];
  }
}

export type SignalLevel = "zero" | "weak" | "full";

export interface Country {
  name: string;
}

export interface State {
  name: string;
}

export interface City {
  name: string;
}

export interface BoundingBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface GeoPoint {
  lat: number;
  lon: number;
  boundingBox?: BoundingBox | null;
}

export interface EstablishmentSignals {
  website: boolean;
  instagram: boolean;
  facebook: boolean;
  email: boolean;
  phone: boolean;
}

export interface EstablishmentContact {
  phoneRaw: string | null;
  phoneDigits: string | null;
  whatsappUrl: string | null;
  whatsappValid: boolean;
  instagramHandle: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  email: string | null;
}

export interface EstablishmentDetails {
  cuisine: string | null;
  openingHours: string | null;
  priceRange: string | null;
  street: string | null;
  housenumber: string | null;
  neighbourhood: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  takeaway: string | null;
  delivery: string | null;
  outdoorSeating: string | null;
  wheelchair: string | null;
  smoking: string | null;
  vegetarian: string | null;
  airConditioning: string | null;
  capacity: string | null;
  brand: string | null;
  operator: string | null;
}

export interface Establishment {
  id: string;
  osmType: string;
  osmId: number;
  name: string;
  category: string;
  categoryKey: CategoryKey | null;
  address: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
  signals: EstablishmentSignals;
  contact: EstablishmentContact;
  details: EstablishmentDetails;
  contactable: boolean;
  signalCount: number;
  level: SignalLevel;
  /** Nota (0-5) quando o OpenStreetMap traz `stars`/`rating`. */
  rating: number | null;
  /** 1 = barato, 2 = médio, 3 = caro. */
  priceLevel: 1 | 2 | 3 | null;
  googleMapsUrl: string;
  osmUrl: string;
  directionsUrl: string;
}

export interface SavedLead extends Establishment {
  savedAt: string;
}

export type CategoryKey =
  | "restaurant"
  | "fast_food"
  | "cafe"
  | "bar"
  | "pub"
  | "bakery"
  | "hairdresser"
  | "beauty"
  | "cosmetics"
  | "pet"
  | "supermarket"
  | "convenience"
  | "clothes"
  | "pharmacy"
  | "hardware"
  | "gym";

export interface CategoryDef {
  label: string;
  /** Filtros Overpass (chave/valor OSM) que pertencem a esta categoria. */
  filters: { key: string; values: string[] }[];
}

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  restaurant: { label: "Restaurantes", filters: [{ key: "amenity", values: ["restaurant"] }] },
  fast_food: { label: "Lanchonetes", filters: [{ key: "amenity", values: ["fast_food"] }] },
  cafe: { label: "Cafés", filters: [{ key: "amenity", values: ["cafe"] }] },
  bar: { label: "Bares", filters: [{ key: "amenity", values: ["bar"] }] },
  pub: { label: "Pubs", filters: [{ key: "amenity", values: ["pub"] }] },
  bakery: { label: "Padarias", filters: [{ key: "shop", values: ["bakery", "pastry"] }] },
  hairdresser: {
    label: "Barbearias / Salões",
    filters: [{ key: "shop", values: ["hairdresser", "barber"] }],
  },
  beauty: {
    label: "Estética",
    filters: [{ key: "shop", values: ["beauty", "massage", "tattoo"] }],
  },
  cosmetics: {
    label: "Cosméticos / Perfumaria",
    filters: [{ key: "shop", values: ["cosmetics", "perfumery", "chemist"] }],
  },
  pet: { label: "Pet shops", filters: [{ key: "shop", values: ["pet", "pet_grooming"] }] },
  supermarket: {
    label: "Supermercados",
    filters: [{ key: "shop", values: ["supermarket", "greengrocer", "butcher"] }],
  },
  convenience: {
    label: "Mercearias",
    filters: [{ key: "shop", values: ["convenience", "kiosk", "general"] }],
  },
  clothes: {
    label: "Lojas de roupa",
    filters: [{ key: "shop", values: ["clothes", "shoes", "boutique", "jewelry"] }],
  },
  pharmacy: { label: "Farmácias", filters: [{ key: "amenity", values: ["pharmacy"] }] },
  hardware: {
    label: "Materiais / Ferragens",
    filters: [{ key: "shop", values: ["hardware", "doityourself", "paint", "florist"] }],
  },
  gym: {
    label: "Academias",
    filters: [{ key: "leisure", values: ["fitness_centre"] }],
  },
};

export const CATEGORY_LABELS: Record<CategoryKey, string> = Object.fromEntries(
  (Object.keys(CATEGORIES) as CategoryKey[]).map((k) => [k, CATEGORIES[k].label])
) as Record<CategoryKey, string>;

/** Rótulo curto para o valor OSM cru (amenity/shop/leisure). */
export const OSM_VALUE_LABELS: Record<string, string> = {
  restaurant: "Restaurante",
  fast_food: "Lanchonete",
  cafe: "Café",
  bar: "Bar",
  pub: "Pub",
  bakery: "Padaria",
  pastry: "Confeitaria",
  hairdresser: "Barbearia / Salão",
  barber: "Barbearia",
  beauty: "Estética",
  massage: "Massagem",
  tattoo: "Tatuagem",
  cosmetics: "Cosméticos",
  perfumery: "Perfumaria",
  chemist: "Drogaria",
  pet: "Pet shop",
  pet_grooming: "Banho e tosa",
  supermarket: "Supermercado",
  greengrocer: "Hortifruti",
  butcher: "Açougue",
  convenience: "Mercearia",
  kiosk: "Quiosque",
  general: "Loja geral",
  clothes: "Loja de roupa",
  shoes: "Calçados",
  boutique: "Boutique",
  jewelry: "Joalheria",
  pharmacy: "Farmácia",
  hardware: "Ferragens",
  doityourself: "Materiais de construção",
  paint: "Tintas",
  florist: "Floricultura",
  fitness_centre: "Academia",
};

export type SortKey =
  | "relevance"
  | "rating_desc"
  | "rating_asc"
  | "price_desc"
  | "price_asc"
  | "name_asc";

export const SORT_LABELS: Record<SortKey, string> = {
  relevance: "Mais relevantes",
  rating_desc: "Melhor avaliados",
  rating_asc: "Pior avaliados",
  price_desc: "Preço: maior primeiro",
  price_asc: "Preço: menor primeiro",
  name_asc: "Nome (A-Z)",
};

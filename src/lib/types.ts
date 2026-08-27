export type SignalLevel = "zero" | "weak" | "full";

export interface Country { name: string; }
export interface State { name: string; }
export interface City { name: string; }

export interface BoundingBox { south: number; north: number; west: number; east: number; }
export interface GeoPoint { lat: number; lon: number; boundingBox?: BoundingBox | null; }

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
  rating: number | null;
  priceLevel: 1 | 2 | 3 | null;
  googleMapsUrl: string;
  osmUrl: string;
  directionsUrl: string;
}

export interface SavedLead extends Establishment { savedAt: string; }

export type CategoryKey =
  | "restaurant" | "fast_food" | "cafe" | "bar" | "pub" | "bakery" | "hairdresser" | "beauty"
  | "cosmetics" | "pet" | "supermarket" | "convenience" | "clothes" | "pharmacy" | "hardware" | "gym"
  | "dentist" | "doctor" | "clinic" | "veterinary" | "car_repair" | "car_wash" | "car_dealer" | "fuel"
  | "laundry" | "florist" | "furniture" | "electronics" | "mobile_phone" | "computer" | "sports" | "books"
  | "toys" | "gift" | "optician" | "jewelry" | "travel_agency" | "real_estate" | "insurance" | "bank"
  | "accountant" | "lawyer" | "photographer" | "printing" | "locksmith" | "plumber" | "electrician";

export interface CategoryDef { label: string; filters: { key: string; values: string[] }[]; }

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  restaurant: { label: "Restaurantes", filters: [{ key: "amenity", values: ["restaurant"] }] },
  fast_food: { label: "Lanchonetes", filters: [{ key: "amenity", values: ["fast_food"] }] },
  cafe: { label: "Cafés", filters: [{ key: "amenity", values: ["cafe"] }] },
  bar: { label: "Bares", filters: [{ key: "amenity", values: ["bar"] }] },
  pub: { label: "Pubs", filters: [{ key: "amenity", values: ["pub"] }] },
  bakery: { label: "Padarias / Confeitarias", filters: [{ key: "shop", values: ["bakery", "pastry"] }] },
  hairdresser: { label: "Barbearias / Salões", filters: [{ key: "shop", values: ["hairdresser", "barber"] }] },
  beauty: { label: "Estética", filters: [{ key: "shop", values: ["beauty", "massage", "tattoo"] }] },
  cosmetics: { label: "Cosméticos / Perfumaria", filters: [{ key: "shop", values: ["cosmetics", "perfumery", "chemist"] }] },
  pet: { label: "Pet shops", filters: [{ key: "shop", values: ["pet", "pet_grooming"] }] },
  supermarket: { label: "Supermercados", filters: [{ key: "shop", values: ["supermarket", "greengrocer", "butcher"] }] },
  convenience: { label: "Mercearias / Conveniência", filters: [{ key: "shop", values: ["convenience", "kiosk", "general"] }] },
  clothes: { label: "Lojas de roupa", filters: [{ key: "shop", values: ["clothes", "shoes", "boutique", "jewelry"] }] },
  pharmacy: { label: "Farmácias", filters: [{ key: "amenity", values: ["pharmacy"] }] },
  hardware: { label: "Materiais / Ferragens", filters: [{ key: "shop", values: ["hardware", "doityourself", "paint"] }] },
  gym: { label: "Academias", filters: [{ key: "leisure", values: ["fitness_centre"] }] },
  dentist: { label: "Dentistas", filters: [{ key: "amenity", values: ["dentist"] }] },
  doctor: { label: "Consultórios médicos", filters: [{ key: "amenity", values: ["doctors"] }] },
  clinic: { label: "Clínicas", filters: [{ key: "amenity", values: ["clinic"] }, { key: "healthcare", values: ["clinic"] }] },
  veterinary: { label: "Veterinários", filters: [{ key: "amenity", values: ["veterinary"] }] },
  car_repair: { label: "Oficinas mecânicas", filters: [{ key: "shop", values: ["car_repair"] }] },
  car_wash: { label: "Lavagem automotiva", filters: [{ key: "amenity", values: ["car_wash"] }] },
  car_dealer: { label: "Concessionárias", filters: [{ key: "shop", values: ["car"] }] },
  fuel: { label: "Postos de combustível", filters: [{ key: "amenity", values: ["fuel"] }] },
  laundry: { label: "Lavanderias", filters: [{ key: "shop", values: ["laundry"] }] },
  florist: { label: "Floriculturas", filters: [{ key: "shop", values: ["florist"] }] },
  furniture: { label: "Móveis / Decoração", filters: [{ key: "shop", values: ["furniture", "interior_decoration"] }] },
  electronics: { label: "Eletrônicos", filters: [{ key: "shop", values: ["electronics"] }] },
  mobile_phone: { label: "Celulares", filters: [{ key: "shop", values: ["mobile_phone"] }] },
  computer: { label: "Informática", filters: [{ key: "shop", values: ["computer"] }] },
  sports: { label: "Artigos esportivos", filters: [{ key: "shop", values: ["sports"] }] },
  books: { label: "Livrarias", filters: [{ key: "shop", values: ["books"] }] },
  toys: { label: "Brinquedos", filters: [{ key: "shop", values: ["toys"] }] },
  gift: { label: "Presentes", filters: [{ key: "shop", values: ["gift"] }] },
  optician: { label: "Óticas", filters: [{ key: "shop", values: ["optician"] }] },
  jewelry: { label: "Joalherias", filters: [{ key: "shop", values: ["jewelry"] }] },
  travel_agency: { label: "Agências de viagem", filters: [{ key: "shop", values: ["travel_agency"] }] },
  real_estate: { label: "Imobiliárias", filters: [{ key: "office", values: ["estate_agent"] }] },
  insurance: { label: "Seguradoras / Corretoras", filters: [{ key: "office", values: ["insurance"] }] },
  bank: { label: "Bancos", filters: [{ key: "amenity", values: ["bank"] }] },
  accountant: { label: "Contabilidade", filters: [{ key: "office", values: ["accountant"] }] },
  lawyer: { label: "Advocacia", filters: [{ key: "office", values: ["lawyer"] }] },
  photographer: { label: "Fotógrafos", filters: [{ key: "shop", values: ["photo"] }] },
  printing: { label: "Gráficas / Impressão", filters: [{ key: "shop", values: ["copyshop", "printing"] }] },
  locksmith: { label: "Chaveiros", filters: [{ key: "craft", values: ["locksmith"] }] },
  plumber: { label: "Encanadores", filters: [{ key: "craft", values: ["plumber"] }] },
  electrician: { label: "Eletricistas", filters: [{ key: "craft", values: ["electrician"] }] },
};

export const CATEGORY_LABELS: Record<CategoryKey, string> = Object.fromEntries(
  (Object.keys(CATEGORIES) as CategoryKey[]).map((k) => [k, CATEGORIES[k].label])
) as Record<CategoryKey, string>;

export const OSM_VALUE_LABELS: Record<string, string> = {
  restaurant: "Restaurante", fast_food: "Lanchonete", cafe: "Café", bar: "Bar", pub: "Pub", bakery: "Padaria", pastry: "Confeitaria",
  hairdresser: "Barbearia / Salão", barber: "Barbearia", beauty: "Estética", massage: "Massagem", tattoo: "Tatuagem", cosmetics: "Cosméticos",
  perfumery: "Perfumaria", chemist: "Drogaria", pet: "Pet shop", pet_grooming: "Banho e tosa", supermarket: "Supermercado",
  greengrocer: "Hortifruti", butcher: "Açougue", convenience: "Mercearia", kiosk: "Quiosque", general: "Loja geral", clothes: "Loja de roupa",
  shoes: "Calçados", boutique: "Boutique", jewelry: "Joalheria", pharmacy: "Farmácia", hardware: "Ferragens", doityourself: "Materiais de construção",
  paint: "Tintas", florist: "Floricultura", fitness_centre: "Academia", dentist: "Dentista", doctors: "Consultório médico", clinic: "Clínica",
  veterinary: "Veterinário", car_repair: "Oficina mecânica", car_wash: "Lavagem automotiva", car: "Concessionária", fuel: "Posto de combustível",
  laundry: "Lavanderia", furniture: "Móveis / Decoração", interior_decoration: "Decoração", electronics: "Eletrônicos", mobile_phone: "Celulares",
  computer: "Informática", sports: "Artigos esportivos", books: "Livraria", toys: "Brinquedos", gift: "Presentes", optician: "Ótica",
  travel_agency: "Agência de viagens", estate_agent: "Imobiliária", insurance: "Seguros", bank: "Banco", accountant: "Contabilidade", lawyer: "Advocacia",
  photo: "Fotógrafo", copyshop: "Gráfica / Copiadora", printing: "Impressão", locksmith: "Chaveiro", plumber: "Encanador", electrician: "Eletricista",
};

export type SortKey = "relevance" | "rating_desc" | "rating_asc" | "price_desc" | "price_asc" | "name_asc";
export const SORT_LABELS: Record<SortKey, string> = {
  relevance: "Mais relevantes", rating_desc: "Melhor avaliados", rating_asc: "Pior avaliados", price_desc: "Preço: maior primeiro", price_asc: "Preço: menor primeiro", name_asc: "Nome (A-Z)",
};

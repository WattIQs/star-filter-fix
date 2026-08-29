export function isValidBrazilianWhatsApp(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const first = raw.split(/[;,/]/)[0] ?? raw;
  let digits = first.replace(/\D/g, "").replace(/^0+/, "");
  if (!/^\+|^00/.test(first) && (digits.length === 10 || digits.length === 11)) digits = `55${digits}`;
  if (!digits.startsWith("55")) return digits.length >= 11 && digits.length <= 15;
  const local = digits.slice(2);
  return /^(?:[1-9]\d)(?:9\d{8})$/.test(local);
}

export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function tokenSet(value: string | null | undefined): Set<string> {
  return new Set(normalizeSearchText(value).split(/\s+/).filter(Boolean));
}

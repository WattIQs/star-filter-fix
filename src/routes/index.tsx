import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Radar } from "lucide-react";
import { searchOverpassServer, verifyLeadsServer, type PlaceSuggestion } from "@/lib/geo.functions";
import { processOverpassResults } from "@/lib/lead-qualification";
import { isStrictSignalZero } from "@/lib/signal-zero-quality";
import { getSavedLeads, saveLead, removeLead, isLeadSaved } from "@/lib/store";
import type { CategoryKey, Establishment, SavedLead, SortKey } from "@/lib/types";
import { CategoryMenu } from "@/components/sinal-zero/CategoryMenu";
import { ExportCsvButton } from "@/components/sinal-zero/ExportCsvButton";
import { FiltersMenu } from "@/components/sinal-zero/FiltersMenu";
import { PlaceRow } from "@/components/sinal-zero/PlaceRow";
import { PlaceSearchBar } from "@/components/sinal-zero/PlaceSearchBar";
import { SavedLeadsDrawer } from "@/components/sinal-zero/SavedLeadsDrawer";

const MapCanvas = lazy(() => import("@/components/sinal-zero/MapCanvas"));
export const Route = createFileRoute("/")({ head: () => ({ meta: [{ title: "Sinal Zero — Mapa de negócios" }, { name: "description", content: "Encontre e qualifique negócios para prospecção." }] }), component: Index });
const DEFAULT_CATEGORIES: CategoryKey[] = [];
const MAX_SPAN = 0.10;
function ratingMatchesFilter(rating: number | null, filter: string): boolean { if (filter === "unrated") return rating === null; if (filter === "any") return true; if (rating === null) return false; const stars = Number.parseInt(filter, 10); if (!Number.isFinite(stars)) return true; if (stars === 5) return rating >= 5; return rating >= stars && rating < stars + 1; }
function MapSkeleton() { return <div className="flex h-full w-full items-center justify-center bg-muted/30"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>; }

function Index() {
  const [categories, setCategories] = useState<CategoryKey[]>(DEFAULT_CATEGORIES);
  const [ratingFilter, setRatingFilter] = useState("any"); const [priceFilter, setPriceFilter] = useState("any"); const [signalZeroOnly, setSignalZeroOnly] = useState(false); const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [scanning, setScanning] = useState(false); const [results, setResults] = useState<Establishment[]>([]); const [savedLeads, setSavedLeads] = useState<SavedLead[]>([]); const [error, setError] = useState<string | null>(null); const [selectedId, setSelectedId] = useState<string | null>(null); const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null); const [place, setPlace] = useState<PlaceSuggestion | null>(null); const [verificationMode, setVerificationMode] = useState<"external" | "local" | "off">("off");
  const scanIdRef = useRef(0);
  useEffect(() => setSavedLeads(getSavedLeads()), []);

  const runScan = async (target: PlaceSuggestion, cats: CategoryKey[]) => {
    if (cats.length === 0) { setError("Escolha pelo menos uma categoria em Categorias."); return; }
    const scanId = ++scanIdRef.current; setError(null); setScanning(true); setResults([]); setSelectedId(null); setCenter({ lat: target.lat, lon: target.lon });
    const bb = target.boundingBox; const half = MAX_SPAN / 2; const area = { south: Math.max(bb?.south ?? -90, target.lat - half), north: Math.min(bb?.north ?? 90, target.lat + half), west: Math.max(bb?.west ?? -180, target.lon - half), east: Math.min(bb?.east ?? 180, target.lon + half) };
    try {
      const data = await searchOverpassServer({ data: { area, categories: cats, signalZeroOnly } }); if (scanId !== scanIdRef.current) return;
      const processed = processOverpassResults(data.elements, cats);
      const candidates = signalZeroOnly ? processed.filter(isStrictSignalZero).filter((r) => Boolean(r.contact.whatsappValid || r.contact.phoneDigits)) : processed;
      if (candidates.length === 0) { setResults([]); setVerificationMode(signalZeroOnly ? "local" : "off"); setError(signalZeroOnly ? "Nenhum Sinal Zero com contato acionável foi encontrado nessa área." : "Nenhum estabelecimento foi encontrado nessa área para as categorias selecionadas."); return; }
      if (!signalZeroOnly) { setVerificationMode("off"); setResults(candidates); return; }
      const verified = await verifyLeadsServer({ data: { leads: candidates.slice(0, 40) } }); if (scanId !== scanIdRef.current) return;
      setVerificationMode(verified.external ? "external" : "local");
      const finalLeads = verified.external ? verified.leads.filter((lead) => lead.verification.status === "verified" && lead.verification.score >= 85) : candidates;
      setResults(finalLeads);
      if (finalLeads.length === 0) setError(verified.external ? "Nenhum candidato passou pela verificação externa de presença digital e contato." : "Nenhum Sinal Zero confiável com telefone/WhatsApp passou nos filtros atuais.");
    } catch (err) { if (scanId !== scanIdRef.current) return; setError(err instanceof Error ? err.message : "Erro ao escanear a área."); }
    finally { if (scanId === scanIdRef.current) setScanning(false); }
  };

  const handlePickPlace = (target: PlaceSuggestion) => { setPlace(target); if (categories.length > 0) void runScan(target, categories); else setError("Escolha uma categoria antes de varrer a área."); };
  const handleCategoriesChange = (next: CategoryKey[]) => { setCategories(next); setError(next.length === 0 ? "Escolha pelo menos uma categoria em Categorias." : null); };
  const handleScanCurrentPlace = () => { if (place) void runScan(place, categories); else setError("Pesquise primeiro uma cidade, bairro ou local."); };
  const handleToggleSave = (lead: Establishment) => { if (isLeadSaved(lead.id)) removeLead(lead.id); else saveLead(lead); setSavedLeads(getSavedLeads()); };

  const visibleResults = useMemo(() => {
    let list = results;
    if (signalZeroOnly) list = list.filter(isStrictSignalZero).filter((r) => Boolean(r.contact.whatsappValid || r.contact.phoneDigits));
    list = list.filter((r) => ratingMatchesFilter(r.rating, ratingFilter)); if (priceFilter !== "any") list = list.filter((r) => r.priceLevel === Number.parseInt(priceFilter, 10));
    const sorted = [...list]; sorted.sort((a, b) => { switch (sortKey) { case "rating_desc": return (b.rating ?? -1) - (a.rating ?? -1); case "rating_asc": return (a.rating ?? 99) - (b.rating ?? 99); case "price_desc": return (b.priceLevel ?? 0) - (a.priceLevel ?? 0); case "price_asc": return (a.priceLevel ?? 99) - (b.priceLevel ?? 99); case "name_asc": return a.name.localeCompare(b.name, "pt-BR"); default: return a.name.localeCompare(b.name, "pt-BR"); } }); return sorted;
  }, [results, signalZeroOnly, ratingFilter, priceFilter, sortKey]);

  const handleSignalZeroChange = (enabled: boolean) => { setSignalZeroOnly(enabled); setVerificationMode(enabled ? "local" : "off"); setError(null); };

  return <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
    <header className="relative z-[3000] flex min-h-14 shrink-0 items-center gap-2 overflow-visible border-b border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur sm:gap-3"><div className="flex shrink-0 items-center gap-2"><Radar className="h-5 w-5 text-signal-zero" /><span className="hidden text-sm font-bold tracking-tight sm:inline">Sinal <span className="text-gradient-signal">Zero</span></span></div><div className="min-w-0 flex-1"><PlaceSearchBar onPick={handlePickPlace} scanning={scanning} currentLabel={place?.shortLabel ?? null} /></div><div className="flex shrink-0 items-center gap-1.5"><CategoryMenu value={categories} onChange={handleCategoriesChange} onScan={handleScanCurrentPlace} scanning={scanning} /><FiltersMenu ratingFilter={ratingFilter} onRatingFilterChange={setRatingFilter} priceFilter={priceFilter} onPriceFilterChange={setPriceFilter} signalZeroOnly={signalZeroOnly} onSignalZeroOnlyChange={handleSignalZeroChange} sortKey={sortKey} onSortKeyChange={setSortKey} /><div className="hidden items-center gap-2 lg:flex"><SavedLeadsDrawer leads={savedLeads} onRemove={(id) => { removeLead(id); setSavedLeads(getSavedLeads()); }} /><ExportCsvButton /></div></div></header>
    <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:gap-3 lg:p-3"><aside className="relative z-20 flex h-[42%] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-border bg-card/60 lg:h-auto lg:w-[460px] lg:rounded-xl lg:border"><div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2.5"><div><h2 className="text-sm font-semibold">{signalZeroOnly ? "Sinais Zero" : "Estabelecimentos"}</h2><p className="text-[10px] text-muted-foreground">{signalZeroOnly ? (verificationMode === "external" ? "Verificados externamente · sem presença digital encontrada" : "Sinal Zero ativado · verificação externa opcional") : "Todos os estabelecimentos encontrados nas categorias selecionadas"}</p></div><span className="text-[11px] text-muted-foreground">{visibleResults.length} encontrados</span></div><div className="min-h-0 flex-1 overflow-y-auto">{scanning ? <div className="space-y-2 px-4 py-3"><div className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{signalZeroOnly ? (verificationMode === "external" ? "Verificando presença digital..." : "Consultando sinais zero...") : "Consultando estabelecimentos..."}</div>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-md border border-border/50 bg-muted/40" />)}</div> : error ? <p className="px-4 py-6 text-xs text-destructive">{error}</p> : visibleResults.length === 0 ? <p className="px-4 py-6 text-xs text-muted-foreground">Pesquise um local, escolha as categorias e clique em Varrer área.</p> : visibleResults.map((item) => <PlaceRow key={item.id} place={item} active={item.id === selectedId} saved={savedLeads.some((l) => l.id === item.id)} onSelect={setSelectedId} onToggleSave={handleToggleSave} />)}</div></aside><main className="relative z-0 min-h-0 flex-1 overflow-hidden border-t border-border lg:rounded-xl lg:border lg:shadow-lg"><ClientOnly fallback={<MapSkeleton />}><Suspense fallback={<MapSkeleton />}><MapCanvas places={visibleResults} selectedId={selectedId} onSelect={setSelectedId} center={center} /></Suspense></ClientOnly>{scanning && <div className="pointer-events-none absolute left-1/2 top-3 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] text-muted-foreground shadow-lg"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />{signalZeroOnly ? "Verificando leads..." : "Buscando estabelecimentos..."}</div>}</main></div>
  </div>;
}

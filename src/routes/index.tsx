import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Radar } from "lucide-react";

import { searchOverpassServer, type PlaceSuggestion } from "@/lib/geo.functions";
import { processOverpassResults } from "@/lib/lead-qualification";
import { getSavedLeads, saveLead, removeLead, isLeadSaved } from "@/lib/store";
import type { CategoryKey, Establishment, SavedLead, SortKey } from "@/lib/types";

import { CategoryMenu } from "@/components/sinal-zero/CategoryMenu";
import { ExportCsvButton } from "@/components/sinal-zero/ExportCsvButton";
import { FiltersMenu } from "@/components/sinal-zero/FiltersMenu";
import { PlaceRow } from "@/components/sinal-zero/PlaceRow";
import { PlaceSearchBar } from "@/components/sinal-zero/PlaceSearchBar";
import { SavedLeadsDrawer } from "@/components/sinal-zero/SavedLeadsDrawer";

const MapCanvas = lazy(() => import("@/components/sinal-zero/MapCanvas"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sinal Zero — Mapa de negócios sem presença digital" },
      { name: "description", content: "Mapa de prospecção com filtros de nota, preço, presença digital e categoria." },
    ],
  }),
  component: Index,
});

const DEFAULT_CATEGORIES: CategoryKey[] = [];
// Uma área menor reduz drasticamente a quantidade de elementos devolvidos pelo Overpass.
const MAX_SPAN = 0.10;

function ratingMatchesFilter(rating: number | null, filter: string): boolean {
  if (filter === "unrated") return rating === null;
  if (filter === "any") return true;
  if (rating === null) return false;
  const stars = Number.parseInt(filter, 10);
  if (!Number.isFinite(stars)) return true;
  if (stars === 5) return rating >= 5;
  return rating >= stars && rating < stars + 1;
}

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function Index() {
  const [categories, setCategories] = useState<CategoryKey[]>(DEFAULT_CATEGORIES);
  const [ratingFilter, setRatingFilter] = useState("any");
  const [priceFilter, setPriceFilter] = useState("any");
  const [presenceFilter, setPresenceFilter] = useState("any");
  const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<Establishment[]>([]);
  const [savedLeads, setSavedLeads] = useState<SavedLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [place, setPlace] = useState<PlaceSuggestion | null>(null);
  const scanIdRef = useRef(0);

  useEffect(() => setSavedLeads(getSavedLeads()), []);

  const runScan = async (target: PlaceSuggestion, cats: CategoryKey[]) => {
    if (cats.length === 0) {
      setError("Escolha pelo menos uma categoria em Categorias.");
      return;
    }

    const scanId = ++scanIdRef.current;
    setError(null);
    setScanning(true);
    setSelectedId(null);
    setCenter({ lat: target.lat, lon: target.lon });

    const bb = target.boundingBox;
    const half = MAX_SPAN / 2;
    const area = {
      south: Math.max(bb?.south ?? -90, target.lat - half),
      north: Math.min(bb?.north ?? 90, target.lat + half),
      west: Math.max(bb?.west ?? -180, target.lon - half),
      east: Math.min(bb?.east ?? 180, target.lon + half),
    };

    try {
      const data = await searchOverpassServer({ data: { area, categories: cats } });
      if (scanId !== scanIdRef.current) return;
      const processed = processOverpassResults(data.elements, cats);
      setResults(processed);
      if (processed.length === 0) {
        setError("Nenhum estabelecimento encontrado. Tente outra categoria ou local.");
      }
    } catch (err) {
      if (scanId !== scanIdRef.current) return;
      setError(err instanceof Error ? err.message : "Erro ao escanear a área.");
    } finally {
      if (scanId === scanIdRef.current) setScanning(false);
    }
  };

  const handlePickPlace = (target: PlaceSuggestion) => {
    setPlace(target);
    if (categories.length > 0) void runScan(target, categories);
    else setError("Escolha uma categoria antes de varrer a área.");
  };

  const handleCategoriesChange = (next: CategoryKey[]) => {
    // Não dispara uma requisição a cada clique. Isso eliminava a sensação de travamento.
    setCategories(next);
    if (next.length === 0) setError("Escolha pelo menos uma categoria em Categorias.");
    else setError(null);
  };

  const handleScanCurrentPlace = () => {
    if (place) void runScan(place, categories);
    else setError("Pesquise primeiro uma cidade, bairro ou local.");
  };

  const handleToggleSave = (lead: Establishment) => {
    if (isLeadSaved(lead.id)) removeLead(lead.id);
    else saveLead(lead);
    setSavedLeads(getSavedLeads());
  };

  const visibleResults = useMemo(() => {
    const order: Record<"zero" | "weak" | "full", number> = { zero: 0, weak: 1, full: 2 };
    let list = results.filter((r) => r.contact.whatsappValid || Boolean(r.contact.instagramUrl));
    list = list.filter((r) => ratingMatchesFilter(r.rating, ratingFilter));

    if (priceFilter !== "any") {
      const level = Number.parseInt(priceFilter, 10);
      list = list.filter((r) => r.priceLevel === level);
    }

    if (presenceFilter === "opportunity") list = list.filter((r) => r.level === "zero" || r.level === "weak");
    else if (presenceFilter === "zero") list = list.filter((r) => r.level === "zero");
    else if (presenceFilter === "weak") list = list.filter((r) => r.level === "weak");
    else if (presenceFilter === "full") list = list.filter((r) => r.level === "full");

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "rating_desc": return (b.rating ?? -1) - (a.rating ?? -1);
        case "rating_asc": return (a.rating ?? 99) - (b.rating ?? 99);
        case "price_desc": return (b.priceLevel ?? 0) - (a.priceLevel ?? 0);
        case "price_asc": return (a.priceLevel ?? 99) - (b.priceLevel ?? 99);
        case "name_asc": return a.name.localeCompare(b.name, "pt-BR");
        default:
          if (a.contactable !== b.contactable) return a.contactable ? -1 : 1;
          return order[a.level] - order[b.level];
      }
    });
    return sorted;
  }, [results, ratingFilter, priceFilter, presenceFilter, sortKey]);

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-[3000] flex min-h-14 shrink-0 items-center gap-2 overflow-visible border-b border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur sm:gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <Radar className="h-5 w-5 text-signal-zero" />
          <span className="hidden text-sm font-bold tracking-tight sm:inline">Sinal <span className="text-gradient-signal">Zero</span></span>
        </div>
        <div className="min-w-0 flex-1">
          <PlaceSearchBar onPick={handlePickPlace} scanning={scanning} currentLabel={place?.shortLabel ?? null} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <CategoryMenu value={categories} onChange={handleCategoriesChange} onScan={handleScanCurrentPlace} scanning={scanning} />
          <FiltersMenu ratingFilter={ratingFilter} onRatingFilterChange={setRatingFilter} priceFilter={priceFilter} onPriceFilterChange={setPriceFilter} presenceFilter={presenceFilter} onPresenceFilterChange={setPresenceFilter} sortKey={sortKey} onSortKeyChange={setSortKey} />
          <div className="hidden items-center gap-2 lg:flex">
            <SavedLeadsDrawer leads={savedLeads} onRemove={(id) => { removeLead(id); setSavedLeads(getSavedLeads()); }} />
            <ExportCsvButton />
          </div>
        </div>
      </header>

      <div className="relative z-0 flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-3 lg:p-3">
        <aside className="relative z-20 flex h-[42%] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-border bg-card/60 lg:h-auto lg:w-[460px] lg:rounded-xl lg:border">
          <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2.5">
            <h2 className="text-sm font-semibold">Resultados</h2>
            <span className="text-[11px] text-muted-foreground">{visibleResults.length} de {results.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {scanning ? (
              <div className="space-y-2 px-4 py-3">
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Consultando a área...</div>
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-md border border-border/50 bg-muted/40" />)}
              </div>
            ) : error ? (
              <p className="px-4 py-6 text-xs text-destructive">{error}</p>
            ) : visibleResults.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground">{results.length === 0 ? "Pesquise um local e escolha categorias para começar." : "Nenhum estabelecimento passou nos filtros atuais."}</p>
            ) : (
              visibleResults.map((item) => <PlaceRow key={item.id} place={item} active={item.id === selectedId} saved={savedLeads.some((l) => l.id === item.id)} onSelect={setSelectedId} onToggleSave={handleToggleSave} />)
            )}
          </div>
        </aside>

        <main className="relative z-0 min-h-0 flex-1 overflow-hidden border-t border-border lg:rounded-xl lg:border lg:shadow-lg">
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <MapCanvas places={visibleResults} selectedId={selectedId} onSelect={setSelectedId} center={center} />
            </Suspense>
          </ClientOnly>
          {scanning && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] text-muted-foreground shadow-lg">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Varrendo área...
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

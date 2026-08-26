import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Map, Radar, Rows3 } from "lucide-react";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sinal Zero — Mapa de negócios" },
      { name: "description", content: "Encontre e qualifique negócios para prospecção." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: Index,
});

const DEFAULT_CATEGORIES: CategoryKey[] = [];
const MAX_SPAN = 0.10;

function ratingMatchesFilter(rating: number | null, filters: string[]): boolean {
  if (filters.length === 0) return true;
  if (rating === null) return filters.includes("unrated");
  return filters.some((filter) => {
    if (filter === "unrated") return false;
    const stars = Number.parseInt(filter, 10);
    if (!Number.isFinite(stars)) return true;
    if (stars === 5) return rating >= 5;
    return rating >= stars && rating < stars + 1;
  });
}

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function hasContact(lead: Establishment): boolean {
  return Boolean(lead.contact.whatsappValid || lead.contact.instagramUrl);
}

function hasWebsite(lead: Establishment): boolean {
  return Boolean(lead.signals.website || lead.contact.websiteUrl);
}

function Index() {
  const [categories, setCategories] = useState<CategoryKey[]>(DEFAULT_CATEGORIES);
  const [ratingFilters, setRatingFilters] = useState<string[]>([]);
  const [priceFilter, setPriceFilter] = useState("any");
  const [signalZeroOnly, setSignalZeroOnly] = useState(false);
  const [contactOnly, setContactOnly] = useState(false);
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<Establishment[]>([]);
  const [allResults, setAllResults] = useState<Establishment[]>([]);
  const [savedLeads, setSavedLeads] = useState<SavedLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [place, setPlace] = useState<PlaceSuggestion | null>(null);
  const [verificationMode, setVerificationMode] = useState<"external" | "local" | "off">("off");
  const [mobileView, setMobileView] = useState<"leads" | "map">("leads");
  const scanIdRef = useRef(0);

  useEffect(() => setSavedLeads(getSavedLeads()), []);

  const runSignalZeroVerification = async (leads: Establishment[], scanId: number) => {
    const candidates = leads.filter(isStrictSignalZero);

    if (candidates.length === 0) {
      if (scanId === scanIdRef.current) {
        setResults([]);
        setVerificationMode("local");
        setError("Nenhum candidato Sinal Zero foi encontrado nessa área.");
      }
      return;
    }

    try {
      const verified = await verifyLeadsServer({ data: { leads: candidates.slice(0, 40) } });
      if (scanId !== scanIdRef.current) return;
      if (!verified.external) {
        setVerificationMode("local");
        setResults([]);
        setError("Sinal Zero precisa consultar a web para confirmar ausência de presença digital. Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX no Render.");
        return;
      }
      setVerificationMode("external");
      const finalLeads = verified.leads.filter((lead) => lead.verification.checked && lead.verification.status === "verified" && lead.verification.score >= 85 && !lead.verification.foundDigitalPresence);
      setResults(finalLeads);
      setError(finalLeads.length === 0 ? "Nenhum candidato passou pela verificação externa como Sinal Zero." : null);
    } catch (err) {
      if (scanId !== scanIdRef.current) return;
      setVerificationMode("local");
      setResults([]);
      setError(err instanceof Error ? err.message : "Não foi possível confirmar o Sinal Zero externamente.");
    }
  };

  const runNoWebsiteVerification = async (leads: Establishment[], scanId: number) => {
    const candidates = leads.filter((lead) => !hasWebsite(lead));
    if (candidates.length === 0) {
      if (scanId === scanIdRef.current) {
        setResults([]);
        setVerificationMode("local");
        setError("Nenhum estabelecimento sem site identificado foi encontrado nessa área.");
      }
      return;
    }

    try {
      const verified = await verifyLeadsServer({ data: { leads: candidates.slice(0, 40) } });
      if (scanId !== scanIdRef.current) return;
      if (!verified.external) {
        setVerificationMode("local");
        setResults([]);
        setError("Para confirmar que o negócio realmente não possui site, a busca externa precisa estar configurada no Render (GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX).");
        return;
      }
      setVerificationMode("external");
      const finalLeads = verified.leads.filter((lead) => lead.verification.checked && lead.verification.status === "verified" && lead.verification.score >= 85 && !lead.verification.foundWebsite);
      setResults(finalLeads);
      setError(finalLeads.length === 0 ? "Nenhum lead passou pela verificação de ausência de site." : null);
    } catch (err) {
      if (scanId !== scanIdRef.current) return;
      setVerificationMode("local");
      setResults([]);
      setError(err instanceof Error ? err.message : "Não foi possível verificar a ausência de site.");
    }
  };

  const runScan = async (target: PlaceSuggestion, cats: CategoryKey[]) => {
    if (cats.length === 0) {
      setError("Escolha pelo menos uma categoria em Categorias.");
      return;
    }

    const scanId = ++scanIdRef.current;
    setError(null);
    setScanning(true);
    setResults([]);
    setAllResults([]);
    setSelectedId(null);
    setCenter({ lat: target.lat, lon: target.lon });
    setVerificationMode("off");
    setMobileView("leads");

    const bb = target.boundingBox;
    const half = MAX_SPAN / 2;
    const area = {
      south: Math.max(bb?.south ?? -90, target.lat - half),
      north: Math.min(bb?.north ?? 90, target.lat + half),
      west: Math.max(bb?.west ?? -180, target.lon - half),
      east: Math.min(bb?.east ?? 180, target.lon + half),
    };

    try {
      const data = await searchOverpassServer({ data: { area, categories: cats, signalZeroOnly } });
      if (scanId !== scanIdRef.current) return;
      const processed = processOverpassResults(data.elements, cats);
      setAllResults(processed);

      if (processed.length === 0) {
        setResults([]);
        setError(signalZeroOnly ? "Nenhum candidato Sinal Zero foi encontrado nessa área." : "Nenhum estabelecimento foi encontrado nessa área para as categorias selecionadas.");
        return;
      }

      if (signalZeroOnly) await runSignalZeroVerification(processed, scanId);
      else if (noWebsiteOnly) await runNoWebsiteVerification(processed, scanId);
      else {
        setResults(processed);
        setVerificationMode("off");
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
    setCategories(next);
    setError(next.length === 0 ? "Escolha pelo menos uma categoria em Categorias." : null);
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

  const handleSignalZeroChange = (enabled: boolean) => {
    setSignalZeroOnly(enabled);
    setError(null);
    setSelectedId(null);
    if (!enabled) {
      setVerificationMode("off");
      if (noWebsiteOnly && allResults.length > 0) {
        const scanId = scanIdRef.current;
        setScanning(true);
        void runNoWebsiteVerification(allResults, scanId).finally(() => { if (scanId === scanIdRef.current) setScanning(false); });
      } else {
        setResults(allResults);
        setScanning(false);
      }
      return;
    }
    if (allResults.length > 0) {
      const scanId = scanIdRef.current;
      setScanning(true);
      void runSignalZeroVerification(allResults, scanId).finally(() => { if (scanId === scanIdRef.current) setScanning(false); });
    }
  };

  const handleNoWebsiteChange = (enabled: boolean) => {
    setNoWebsiteOnly(enabled);
    setError(null);
    setSelectedId(null);
    if (!enabled) {
      setVerificationMode(signalZeroOnly ? "external" : "off");
      setResults(allResults);
      return;
    }
    if (signalZeroOnly) return;
    if (allResults.length > 0) {
      const scanId = scanIdRef.current;
      setScanning(true);
      void runNoWebsiteVerification(allResults, scanId).finally(() => { if (scanId === scanIdRef.current) setScanning(false); });
    }
  };

  const visibleResults = useMemo(() => {
    let list = results;
    if (contactOnly) list = list.filter(hasContact);
    list = list.filter((r) => ratingMatchesFilter(r.rating, ratingFilters));
    if (priceFilter !== "any") {
      const level = Number.parseInt(priceFilter, 10);
      list = list.filter((r) => r.priceLevel === level);
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "rating_desc": return (b.rating ?? -1) - (a.rating ?? -1);
        case "rating_asc": return (a.rating ?? 99) - (b.rating ?? 99);
        case "price_desc": return (b.priceLevel ?? 0) - (a.priceLevel ?? 0);
        case "price_asc": return (a.priceLevel ?? 99) - (b.priceLevel ?? 99);
        case "name_asc": return a.name.localeCompare(b.name, "pt-BR");
        default: return a.name.localeCompare(b.name, "pt-BR");
      }
    });
    return sorted;
  }, [results, contactOnly, ratingFilters, priceFilter, sortKey]);

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground lg:h-screen">
      <header className="relative z-[3000] shrink-0 border-b border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur lg:flex lg:min-h-14 lg:items-center lg:gap-3 lg:px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex shrink-0 items-center gap-2"><Radar className="h-5 w-5 text-signal-zero" /><span className="hidden text-sm font-bold tracking-tight sm:inline">Sinal <span className="text-gradient-signal">Zero</span></span></div>
          <div className="min-w-0 flex-1 lg:hidden"><PlaceSearchBar onPick={handlePickPlace} scanning={scanning} currentLabel={place?.shortLabel ?? null} /></div>
        </div>
        <div className="mt-2 min-w-0 lg:mt-0 lg:flex-1 lg:block"><div className="hidden lg:block"><PlaceSearchBar onPick={handlePickPlace} scanning={scanning} currentLabel={place?.shortLabel ?? null} /></div></div>
        <div className="mt-2 flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mt-0 lg:shrink-0">
          <CategoryMenu value={categories} onChange={handleCategoriesChange} onScan={handleScanCurrentPlace} scanning={scanning} />
          <FiltersMenu ratingFilters={ratingFilters} onRatingFiltersChange={setRatingFilters} priceFilter={priceFilter} onPriceFilterChange={setPriceFilter} signalZeroOnly={signalZeroOnly} onSignalZeroOnlyChange={handleSignalZeroChange} contactOnly={contactOnly} onContactOnlyChange={setContactOnly} noWebsiteOnly={noWebsiteOnly} onNoWebsiteOnlyChange={handleNoWebsiteChange} sortKey={sortKey} onSortKeyChange={setSortKey} />
          <div className="hidden items-center gap-2 lg:flex"><SavedLeadsDrawer leads={savedLeads} onRemove={(id) => { removeLead(id); setSavedLeads(getSavedLeads()); }} /><ExportCsvButton /></div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:relative lg:flex-row lg:gap-3 lg:p-3">
        <div className="flex shrink-0 border-b border-border bg-card px-2 py-1.5 lg:hidden">
          <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Área de trabalho">
            <button type="button" role="tab" aria-selected={mobileView === "leads"} onClick={() => setMobileView("leads")} className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition-all ${mobileView === "leads" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><Rows3 className="h-4 w-4" />Leads <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{visibleResults.length}</span></button>
            <button type="button" role="tab" aria-selected={mobileView === "map"} onClick={() => setMobileView("map")} className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition-all ${mobileView === "map" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><Map className="h-4 w-4" />Mapa</button>
          </div>
        </div>

        <aside className={`relative z-20 flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-card/60 lg:h-auto lg:w-[460px] lg:flex-none lg:rounded-xl lg:border ${mobileView === "leads" ? "" : "hidden"} lg:flex`}>
          <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2.5"><div className="min-w-0"><h2 className="text-sm font-semibold">{signalZeroOnly ? "Sinais Zero" : "Estabelecimentos"}</h2><p className="truncate text-[10px] text-muted-foreground">{signalZeroOnly ? (verificationMode === "external" ? "Verificados externamente · sem presença digital encontrada" : "Sinal Zero ativado") : noWebsiteOnly ? "Sem site confirmado por busca externa" : "Todos os estabelecimentos encontrados nas categorias selecionadas"}</p></div><span className="shrink-0 text-[11px] text-muted-foreground">{visibleResults.length} encontrados</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {scanning ? <div className="space-y-2 px-4 py-3"><div className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{signalZeroOnly ? "Verificando Sinal Zero..." : noWebsiteOnly ? "Pesquisando negócios sem site..." : "Consultando estabelecimentos..."}</div>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-md border border-border/50 bg-muted/40" />)}</div> : error ? <p className="px-4 py-6 text-xs text-destructive">{error}</p> : visibleResults.length === 0 ? <p className="px-4 py-6 text-xs text-muted-foreground">Pesquise um local, escolha as categorias e clique em Varrer área.</p> : visibleResults.map((item) => <PlaceRow key={item.id} place={item} active={item.id === selectedId} saved={savedLeads.some((l) => l.id === item.id)} onSelect={setSelectedId} onToggleSave={handleToggleSave} />)}
          </div>
        </aside>

        <main className={`relative z-0 min-h-0 flex-1 overflow-hidden border-border lg:rounded-xl lg:border lg:shadow-lg ${mobileView === "map" ? "" : "hidden"} lg:block`}>
          <ClientOnly fallback={<MapSkeleton />}><Suspense fallback={<MapSkeleton />}><MapCanvas places={visibleResults} selectedId={selectedId} onSelect={setSelectedId} center={center} /></Suspense></ClientOnly>
          {scanning && <div className="pointer-events-none absolute left-1/2 top-3 z-[500] flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] text-muted-foreground shadow-lg"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span className="truncate">{signalZeroOnly ? "Verificando Sinal Zero..." : noWebsiteOnly ? "Pesquisando negócios sem site..." : "Buscando estabelecimentos..."}</span></div>}
        </main>
      </div>
    </div>
  );
}

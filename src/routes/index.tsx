import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Map as MapIcon, Radar, Rows3 } from "lucide-react";
import { searchOverpassServer, verifyLeadsServer, type PlaceSuggestion } from "@/lib/geo.functions";
import { processOverpassResults } from "@/lib/lead-qualification";
import { getSavedLeads, isLeadSaved, removeLead, saveLead } from "@/lib/saved-leads";
import type { CategoryKey, Establishment, SavedLead, SortKey } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { CategoryMenu } from "@/components/sinal-zero/CategoryMenu";
import { ExportCsvButton } from "@/components/sinal-zero/ExportCsvButton";
import { FiltersMenu } from "@/components/sinal-zero/FiltersMenu";
import { PlaceRow } from "@/components/sinal-zero/PlaceRow";
import { PlaceSearchBar } from "@/components/sinal-zero/PlaceSearchBar";
import { SavedLeadsDrawer } from "@/components/sinal-zero/SavedLeadsDrawer";

const MapCanvas = lazy(() => import("@/components/sinal-zero/MapCanvas"));

type SignalFilter = "zero" | "weak" | "medium" | "high";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Sinal Zero — Mapa de negócios" },
    { name: "description", content: "Encontre e qualifique negócios para prospecção." },
    { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
  ]}),
  component: Index,
});

const DEFAULT_CATEGORIES: CategoryKey[] = [];

function ratingMatchesFilter(rating: number | null, filters: string[]): boolean {
  if (filters.length === 0) return true;
  if (rating === null) return filters.includes("unrated");
  return filters.some((filter) => {
    if (filter === "unrated") return false;
    const stars = Number.parseInt(filter, 10);
    if (!Number.isFinite(stars)) return false;
    return rating === stars;
  });
}

function categoryMatches(lead: Establishment, categories: CategoryKey[]): boolean {
  if (categories.length === 0) return true;
  if (lead.categoryKey && categories.includes(lead.categoryKey)) return true;
  return categories.some((category) => CATEGORIES[category].filters.some((filter) => {
    const value = lead.tags[filter.key];
    return Boolean(value && filter.values.includes(value));
  }));
}

function hasWhatsappOrInstagram(lead: Establishment): boolean {
  return Boolean(lead.contact.whatsappValid || lead.contact.instagramUrl);
}

function hasWebsite(lead: Establishment): boolean {
  return Boolean(lead.signals.website || lead.contact.websiteUrl);
}

function matchesSignalFilter(lead: Establishment, filters: SignalFilter[]): boolean {
  if (filters.length === 0) return true;
  return filters.some((filter) => {
    switch (filter) {
      case "zero": return lead.signalCount === 0;
      case "weak": return lead.signalCount === 1;
      case "medium": return lead.signalCount === 2;
      case "high": return lead.signalCount === 3;
    }
  });
}

function applyPresenceFilters(leads: Establishment[], signalFilters: SignalFilter[], noWebsite: boolean): Establishment[] {
  return leads.filter((lead) => {
    if (!matchesSignalFilter(lead, signalFilters)) return false;
    if (noWebsite && hasWebsite(lead)) return false;
    return true;
  });
}

function MapSkeleton() {
  return <div className="flex h-full w-full items-center justify-center bg-muted/30"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
}

function Index() {
  const searchPlaces = useServerFn(searchOverpassServer);
  const verifyLeads = useServerFn(verifyLeadsServer);
  const [categories, setCategories] = useState<CategoryKey[]>(DEFAULT_CATEGORIES);
  const [ratingFilters, setRatingFilters] = useState<string[]>([]);
  const [priceFilter, setPriceFilter] = useState("any");
  const [signalFilters, setSignalFilters] = useState<SignalFilter[]>([]);
  const [contactOnly, setContactOnly] = useState(false);
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [scanning, setScanning] = useState(false);
  const [verifyingPresence, setVerifyingPresence] = useState(false);
  const [results, setResults] = useState<Establishment[]>([]);
  const [allResults, setAllResults] = useState<Establishment[]>([]);
  const [savedLeads, setSavedLeads] = useState<SavedLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [place, setPlace] = useState<PlaceSuggestion | null>(null);
  const [mobileView, setMobileView] = useState<"leads" | "map">("leads");
  const scanIdRef = useRef(0);
  const verificationCacheRef = useRef(new globalThis.Map<string, Establishment>());

  useEffect(() => {
    setSavedLeads(getSavedLeads());
  }, []);

  const filterByCategory = (leads: Establishment[], selected = categories) => leads.filter((lead) => categoryMatches(lead, selected));

  const applyCurrentFilters = (source: Establishment[], selectedCategories = categories, selectedSignals = signalFilters, noWebsite = noWebsiteOnly) => {
    const next = applyPresenceFilters(filterByCategory(source, selectedCategories), selectedSignals, noWebsite);
    setResults(next);
    setError(next.length === 0 && source.length > 0 ? "Nenhum resultado para os filtros atuais." : null);
  };

  const enrichPresence = async (source: Establishment[], scanId?: number): Promise<Establishment[] | null> => {
    const missing = source.filter((lead) => !verificationCacheRef.current.has(lead.id));
    if (missing.length === 0) return source.map((lead) => verificationCacheRef.current.get(lead.id) ?? lead);

    setVerifyingPresence(true);
    setError(null);
    try {
      const response = await verifyLeads({ data: { leads: missing } });
      if (!response.external) throw new Error("A verificação Google não está configurada no servidor.");
      if (scanId !== undefined && scanId !== scanIdRef.current) return null;
      for (const lead of response.leads) verificationCacheRef.current.set(lead.id, lead);
      return source.map((lead) => verificationCacheRef.current.get(lead.id) ?? lead);
    } catch (err) {
      if (scanId === undefined || scanId === scanIdRef.current) {
        setError(err instanceof Error ? err.message : "Não foi possível verificar a presença digital.");
      }
      return null;
    } finally {
      if (scanId === undefined || scanId === scanIdRef.current) setVerifyingPresence(false);
    }
  };

  const refreshPresenceFilters = async (source: Establishment[], selectedSignals = signalFilters, noWebsite = noWebsiteOnly) => {
    const needsVerification = selectedSignals.length > 0 || noWebsite || contactOnly;
    if (!needsVerification) {
      applyCurrentFilters(source, categories, selectedSignals, noWebsite);
      return;
    }
    setResults([]);
    const enriched = await enrichPresence(source);
    if (enriched) {
      setAllResults(enriched);
      applyCurrentFilters(enriched, categories, selectedSignals, noWebsite);
    }
  };

  const runScan = async (target: PlaceSuggestion) => {
    const scanId = ++scanIdRef.current;
    verificationCacheRef.current.clear();
    setError(null);
    setScanning(true);
    setVerifyingPresence(false);
    setResults([]);
    setAllResults([]);
    setSelectedId(null);
    setCenter({ lat: target.lat, lon: target.lon });
    setMobileView("leads");

    try {
      const data = await searchPlaces({ data: { area: target.boundingBox ?? { south: target.lat - 0.025, north: target.lat + 0.025, west: target.lon - 0.03, east: target.lon + 0.03 }, categories } });
      if (scanId !== scanIdRef.current) return;
      const processed = processOverpassResults(data.elements, categories);
      if (signalFilters.length > 0 || contactOnly || noWebsiteOnly) {
        setResults([]);
        const enriched = await enrichPresence(processed, scanId);
        if (scanId !== scanIdRef.current) return;
        if (enriched) {
          setAllResults(enriched);
          applyCurrentFilters(enriched, categories, signalFilters, noWebsiteOnly);
        }
      } else {
        setAllResults(processed);
        setResults(processed);
      }
      if (processed.length === 0) setError("Nenhum estabelecimento foi encontrado nessa área para as categorias selecionadas.");
    } catch (err) {
      if (scanId !== scanIdRef.current) return;
      setError(err instanceof Error ? err.message : "Erro ao pesquisar a área.");
    } finally {
      if (scanId === scanIdRef.current) setScanning(false);
    }
  };

  const handlePickPlace = (target: PlaceSuggestion) => {
    setPlace(target);
    setCenter({ lat: target.lat, lon: target.lon });
    setError(null);
  };

  const handleScanCurrentPlace = () => {
    if (place) void runScan(place);
    else setError("Pesquise primeiro uma cidade, bairro ou local.");
  };

  const handleCategoriesChange = (next: CategoryKey[]) => {
    setCategories(next);
    setError(null);
    if (allResults.length > 0) void refreshPresenceFilters(allResults, signalFilters, noWebsiteOnly);
  };

  const handleToggleSave = (lead: Establishment) => {
    if (isLeadSaved(lead.id)) removeLead(lead.id); else saveLead(lead);
    setSavedLeads(getSavedLeads());
  };

  const handleSignalFiltersChange = (next: SignalFilter[]) => {
    setSignalFilters(next);
    if (allResults.length > 0) void refreshPresenceFilters(allResults, next, noWebsiteOnly);
  };

  const handleContactChange = (enabled: boolean) => {
    setContactOnly(enabled);
    if (allResults.length > 0) void refreshPresenceFilters(allResults, signalFilters, noWebsiteOnly);
  };

  const handleNoWebsiteChange = (enabled: boolean) => {
    setNoWebsiteOnly(enabled);
    if (allResults.length > 0) void refreshPresenceFilters(allResults, signalFilters, enabled);
  };

  const visibleResults = useMemo(() => {
    let list = results.filter((lead) => categoryMatches(lead, categories));
    if (contactOnly) list = list.filter(hasWhatsappOrInstagram);
    list = list.filter((lead) => ratingMatchesFilter(lead.rating, ratingFilters));
    if (priceFilter !== "any") {
      const level = Number.parseInt(priceFilter, 10);
      list = list.filter((lead) => lead.priceLevel === level);
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "rating_desc": return (b.rating ?? -1) - (a.rating ?? -1);
        case "rating_asc": return (a.rating ?? 99) - (b.rating ?? 99);
        case "price_desc": return (b.priceLevel ?? 0) - (a.priceLevel ?? 0);
        case "price_asc": return (a.priceLevel ?? 99) - (b.priceLevel ?? 99);
        case "name_asc": return a.name.localeCompare(b.name, "pt-BR");
        default: return (a.signalCount - b.signalCount) || (Number(b.contactable) - Number(a.contactable)) || ((b.rating ?? -1) - (a.rating ?? -1)) || a.name.localeCompare(b.name, "pt-BR");
      }
    });
    return sorted;
  }, [results, categories, contactOnly, ratingFilters, priceFilter, sortKey]);

  const signalTitle = signalFilters.length === 0
    ? "Estabelecimentos"
    : signalFilters.length === 1
      ? `Sinal ${signalFilters[0] === "zero" ? "Zero" : signalFilters[0] === "weak" ? "Fraco" : signalFilters[0] === "medium" ? "Médio" : "Alto"}`
      : `${signalFilters.length} sinais selecionados`;

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground lg:h-screen">
      <header className="relative z-[3000] shrink-0 border-b border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur lg:flex lg:min-h-14 lg:items-center lg:gap-3 lg:px-3">
        <div className="flex min-w-0 items-center gap-2"><div className="flex shrink-0 items-center gap-2"><Radar className="h-5 w-5 text-signal-zero" /><span className="hidden text-sm font-bold tracking-tight sm:inline">Sinal <span className="text-gradient-signal">Zero</span></span></div><div className="min-w-0 flex-1 lg:hidden"><PlaceSearchBar onPick={handlePickPlace} scanning={scanning || verifyingPresence} currentLabel={place?.shortLabel ?? null} /></div></div>
        <div className="mt-2 min-w-0 lg:mt-0 lg:flex-1 lg:block"><div className="hidden lg:block"><PlaceSearchBar onPick={handlePickPlace} scanning={scanning || verifyingPresence} currentLabel={place?.shortLabel ?? null} /></div></div>
        <div className="mt-2 flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mt-0 lg:shrink-0"><CategoryMenu value={categories} onChange={handleCategoriesChange} onScan={handleScanCurrentPlace} scanning={scanning || verifyingPresence} /><FiltersMenu ratingFilters={ratingFilters} onRatingFiltersChange={setRatingFilters} priceFilter={priceFilter} onPriceFilterChange={setPriceFilter} signalFilters={signalFilters} onSignalFiltersChange={handleSignalFiltersChange} contactOnly={contactOnly} onContactOnlyChange={handleContactChange} noWebsiteOnly={noWebsiteOnly} onNoWebsiteOnlyChange={handleNoWebsiteChange} sortKey={sortKey} onSortKeyChange={setSortKey} /><div className="hidden items-center gap-2 lg:flex"><SavedLeadsDrawer leads={savedLeads} onRemove={(id) => { removeLead(id); setSavedLeads(getSavedLeads()); }} /><ExportCsvButton /></div></div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:relative lg:flex-row lg:gap-3 lg:p-3">
        <div className="flex shrink-0 border-b border-border bg-card px-2 py-1.5 lg:hidden"><div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Área de trabalho"><button type="button" role="tab" aria-selected={mobileView === "leads"} onClick={() => setMobileView("leads")} className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition-all ${mobileView === "leads" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><Rows3 className="h-4 w-4" />Leads <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{visibleResults.length}</span></button><button type="button" role="tab" aria-selected={mobileView === "map"} onClick={() => setMobileView("map")} className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition-all ${mobileView === "map" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><MapIcon className="h-4 w-4" />Mapa</button></div></div>
        <aside className={`relative z-20 flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-card/60 lg:h-auto lg:w-[460px] lg:flex-none lg:rounded-xl lg:border ${mobileView === "leads" ? "" : "hidden"} lg:flex`}><div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2.5"><div className="min-w-0"><h2 className="text-sm font-semibold">{signalTitle}{noWebsiteOnly ? " + sem site" : ""}</h2></div><span className="text-xs text-muted-foreground">{visibleResults.length}</span></div><div className="min-h-0 flex-1 overflow-auto p-2"><Suspense fallback={<MapSkeleton />}><div className="space-y-2">{visibleResults.map((place) => <PlaceRow key={place.id} place={place} active={selectedId === place.id} saved={savedLeads.some((saved) => saved.id === place.id)} onSelect={() => setSelectedId(place.id)} onToggleSave={handleToggleSave} />)}</div></Suspense>{visibleResults.length === 0 && !scanning && !verifyingPresence && <div className="p-6 text-center text-sm text-muted-foreground">{error ?? "Nenhum resultado para os filtros atuais."}</div>}{(scanning || verifyingPresence) && <div className="flex items-center justify-center p-6 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{scanning ? "Pesquisando..." : "Verificando presença digital..."}</div>}</div></aside>
        <section className={`relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-muted/20 ${mobileView === "map" ? "" : "hidden lg:block"}`}><ClientOnly fallback={<MapSkeleton />}><MapCanvas center={center} places={visibleResults} selectedId={selectedId} onSelect={setSelectedId} /></ClientOnly></section>
      </div>
    </div>
  );
}

export default Index;

import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Map, Radar, Rows3 } from "lucide-react";
import { searchOverpassServer, verifyLeadsServer, type PlaceSuggestion } from "@/lib/geo.functions";
import { processOverpassResults } from "@/lib/lead-qualification";
import type { CategoryKey, Establishment, SavedLead, SortKey } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
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
type VerificationMode = "signal-zero" | "no-website" | "both";

function ratingMatchesFilter(rating: number | null, filters: string[]): boolean {
  if (filters.length === 0) return true;
  if (rating === null) return filters.includes("unrated");
  return filters.some((filter) => {
    if (filter === "unrated") return false;
    const stars = Number.parseInt(filter, 10);
    if (!Number.isFinite(stars)) return false;
    return stars === 5 ? rating >= 5 : rating >= stars && rating < stars + 1;
  });
}

function categoryMatches(lead: Establishment, categories: CategoryKey[]): boolean {
  if (categories.length === 0) return true;
  if (lead.categoryKey && categories.includes(lead.categoryKey)) return true;
  return categories.some((category) =>
    CATEGORIES[category].filters.some((filter) => {
      const value = lead.tags[filter.key];
      return Boolean(value && filter.values.includes(value));
    }),
  );
}

function MapSkeleton() {
  return <div className="flex h-full w-full items-center justify-center bg-muted/30"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
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
  const [verificationMode, setVerificationMode] = useState<"external" | "off">("off");
  const [mobileView, setMobileView] = useState<"leads" | "map">("leads");
  const scanIdRef = useRef(0);

  useEffect(() => setSavedLeads(getSavedLeads()), []);

  const filterByCategory = (leads: Establishment[]) => leads.filter((lead) => categoryMatches(lead, categories));

  const verifyPresence = async (leads: Establishment[], scanId: number, mode: VerificationMode) => {
    if (leads.length === 0) {
      if (scanId === scanIdRef.current) {
        setResults([]);
        setError(mode === "signal-zero" ? "Nenhum candidato encontrado para verificação Sinal Zero." : mode === "no-website" ? "Nenhum candidato disponível para verificar ausência de site." : "Nenhum candidato satisfaz os filtros de presença.");
      }
      return;
    }

    try {
      const verified = await verifyLeadsServer({ data: { leads } });
      if (scanId !== scanIdRef.current) return;
      if (!verified.external) {
        setVerificationMode("off");
        setResults([]);
        setError("A verificação web está indisponível. Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX no Render.");
        return;
      }

      setVerificationMode("external");
      const finalLeads = verified.leads.filter((lead) => {
        // These filters are based on the actual verification flags, not on the
        // generic verification status. A lead with a website can be "rejected"
        // by the generic classifier and still be a valid result for "no website"
        // only when foundWebsite is false. Likewise, Sinal Zero is defined by the
        // absence of digital presence, not by the generic status string.
        if (!lead.verification.checked) return false;
        const signalMatch = !signalZeroOnly || !lead.verification.foundDigitalPresence;
        const websiteMatch = !noWebsiteOnly || !lead.verification.foundWebsite;
        return signalMatch && websiteMatch;
      });
      setResults(finalLeads);
      setError(finalLeads.length === 0 ? "Nenhum lead passou pelos filtros de presença selecionados." : null);
    } catch (err) {
      if (scanId !== scanIdRef.current) return;
      setVerificationMode("off");
      setResults([]);
      setError(err instanceof Error ? err.message : "Não foi possível concluir a verificação web.");
    }
  };

  const runVerificationForCurrentFilters = (signalZero: boolean, noWebsite: boolean, source = allResults) => {
    const categoryResults = filterByCategory(source);
    const scanId = ++scanIdRef.current;
    setError(null);
    setSelectedId(null);

    if (!signalZero && !noWebsite) {
      setVerificationMode("off");
      setResults(categoryResults);
      setScanning(false);
      return;
    }

    setScanning(true);
    const candidates = noWebsite ? categoryResults.filter((lead) => !hasWebsite(lead)) : categoryResults;
    const mode: VerificationMode = signalZero && noWebsite ? "both" : signalZero ? "signal-zero" : "no-website";
    void verifyPresence(candidates, scanId, mode).finally(() => {
      if (scanId === scanIdRef.current) setScanning(false);
    });
  };

  const runScan = async (target: PlaceSuggestion) => {
    const scanId = ++scanIdRef.current;
    setError(null);
    setScanning(true);
    setResults([]);
    setAllResults([]);
    setSelectedId(null);
    setCenter({ lat: target.lat, lon: target.lon });
    setVerificationMode("off");
    setMobileView("leads");

    const area = target.boundingBox ?? { south: target.lat - 0.05, north: target.lat + 0.05, west: target.lon - 0.05, east: target.lon + 0.05 };

    try {
      const data = await searchOverpassServer({ data: { area, categories: [] } });
      if (scanId !== scanIdRef.current) return;
      const processed = processOverpassResults(data.elements, []);
      setAllResults(processed);

      if (processed.length === 0) {
        setResults([]);
        setError("Nenhum estabelecimento foi encontrado nessa área. Tente outro local ou amplie a área pesquisada.");
        return;
      }

      runVerificationForCurrentFilters(signalZeroOnly, noWebsiteOnly, processed);
    } catch (err) {
      if (scanId !== scanIdRef.current) return;
      setError(err instanceof Error ? err.message : "Erro ao pesquisar a área.");
    } finally {
      if (scanId === scanIdRef.current) setScanning(false);
    }
  };

  const handlePickPlace = (target: PlaceSuggestion) => { setPlace(target); void runScan(target); };
  const handleScanCurrentPlace = () => { if (place) void runScan(place); else setError("Pesquise primeiro uma cidade, bairro ou local."); };

  const handleCategoriesChange = (next: CategoryKey[]) => {
    setCategories(next);
    setError(null);
    if (allResults.length > 0) runVerificationForCurrentFilters(signalZeroOnly, noWebsiteOnly);
  };

  const handleToggleSave = (lead: Establishment) => {
    if (isLeadSaved(lead.id)) removeLead(lead.id); else saveLead(lead);
    setSavedLeads(getSavedLeads());
  };

  const handleSignalZeroChange = (enabled: boolean) => {
    setSignalZeroOnly(enabled);
    if (allResults.length > 0) runVerificationForCurrentFilters(enabled, noWebsiteOnly);
  };

  const handleNoWebsiteChange = (enabled: boolean) => {
    setNoWebsiteOnly(enabled);
    if (allResults.length > 0) runVerificationForCurrentFilters(signalZeroOnly, enabled);
  };

  const visibleResults = useMemo(() => {
    let list = results.filter((lead) => categoryMatches(lead, categories));
    if (contactOnly) list = list.filter(hasContact);
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

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground lg:h-screen">
      <header className="relative z-[3000] shrink-0 border-b border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur lg:flex lg:min-h-14 lg:items-center lg:gap-3 lg:px-3">
        <div className="flex min-w-0 items-center gap-2"><div className="flex shrink-0 items-center gap-2"><Radar className="h-5 w-5 text-signal-zero" /><span className="hidden text-sm font-bold tracking-tight sm:inline">Sinal <span className="text-gradient-signal">Zero</span></span></div><div className="min-w-0 flex-1 lg:hidden"><PlaceSearchBar onPick={handlePickPlace} scanning={scanning} currentLabel={place?.shortLabel ?? null} /></div></div>
        <div className="mt-2 min-w-0 lg:mt-0 lg:flex-1 lg:block"><div className="hidden lg:block"><PlaceSearchBar onPick={handlePickPlace} scanning={scanning} currentLabel={place?.shortLabel ?? null} /></div></div>
        <div className="mt-2 flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mt-0 lg:shrink-0"><CategoryMenu value={categories} onChange={handleCategoriesChange} onScan={handleScanCurrentPlace} scanning={scanning} /><FiltersMenu ratingFilters={ratingFilters} onRatingFiltersChange={setRatingFilters} priceFilter={priceFilter} onPriceFilterChange={setPriceFilter} signalZeroOnly={signalZeroOnly} onSignalZeroOnlyChange={handleSignalZeroChange} contactOnly={contactOnly} onContactOnlyChange={setContactOnly} noWebsiteOnly={noWebsiteOnly} onNoWebsiteOnlyChange={handleNoWebsiteChange} sortKey={sortKey} onSortKeyChange={setSortKey} /><div className="hidden items-center gap-2 lg:flex"><SavedLeadsDrawer leads={savedLeads} onRemove={(id) => { removeLead(id); setSavedLeads(getSavedLeads()); }} /><ExportCsvButton /></div></div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:relative lg:flex-row lg:gap-3 lg:p-3">
        <div className="flex shrink-0 border-b border-border bg-card px-2 py-1.5 lg:hidden"><div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Área de trabalho"><button type="button" role="tab" aria-selected={mobileView === "leads"} onClick={() => setMobileView("leads")} className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition-all ${mobileView === "leads" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><Rows3 className="h-4 w-4" />Leads <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{visibleResults.length}</span></button><button type="button" role="tab" aria-selected={mobileView === "map"} onClick={() => setMobileView("map")} className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition-all ${mobileView === "map" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><Map className="h-4 w-4" />Mapa</button></div></div>
        <aside className={`relative z-20 flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-card/60 lg:h-auto lg:w-[460px] lg:flex-none lg:rounded-xl lg:border ${mobileView === "leads" ? "" : "hidden"} lg:flex`}><div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2.5"><div className="min-w-0"><h2 className="text-sm font-semibold">{signalZeroOnly && noWebsiteOnly ? "Sinal Zero + sem site" : signalZeroOnly ? "Sinais Zero" : noWebsiteOnly ? "Sem site" : "Estabelecimentos"}</h2><p className="truncate text-[10px] text-muted-foreground">{signalZeroOnly && noWebsiteOnly ? "Verificados externamente · sem presença digital e sem site" : signalZeroOnly ? "Verificados externamente · sem presença digital encontrada" : noWebsiteOnly ? "Verificados externamente · sem site próprio encontrado" : "Resultados da área selecionada"}</p></div><span className="shrink-0 text-[11px] text-muted-foreground">{visibleResults.length} encontrados</span></div><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{scanning ? <div className="space-y-2 px-4 py-3"><div className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{signalZeroOnly && noWebsiteOnly ? "Verificando presença e site..." : signalZeroOnly ? "Verificando Sinal Zero..." : noWebsiteOnly ? "Pesquisando negócios sem site..." : "Consultando estabelecimentos..."}</div>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-md border border-border/50 bg-muted/40" />)}</div> : error ? <p className="px-4 py-6 text-xs text-destructive">{error}</p> : visibleResults.length === 0 ? <p className="px-4 py-6 text-xs text-muted-foreground">Nenhum lead corresponde aos filtros selecionados.</p> : visibleResults.map((item) => <PlaceRow key={item.id} place={item} active={item.id === selectedId} saved={savedLeads.some((l) => l.id === item.id)} onSelect={setSelectedId} onToggleSave={handleToggleSave} />)}</div></aside>
        <main className={`relative z-0 min-h-0 flex-1 overflow-hidden border-border lg:rounded-xl lg:border lg:shadow-lg ${mobileView === "map" ? "" : "hidden"} lg:block`}><ClientOnly fallback={<MapSkeleton />}><Suspense fallback={<MapSkeleton />}><MapCanvas places={visibleResults} selectedId={selectedId} onSelect={setSelectedId} center={center} /></Suspense></ClientOnly>{scanning && <div className="pointer-events-none absolute left-1/2 top-3 z-[500] flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] text-muted-foreground shadow-lg"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span className="truncate">{signalZeroOnly && noWebsiteOnly ? "Verificando presença e site..." : signalZeroOnly ? "Verificando Sinal Zero..." : noWebsiteOnly ? "Pesquisando negócios sem site..." : "Buscando estabelecimentos..."}</span></div>}</main>
      </div>
    </div>
  );
}

function getSavedLeads(): SavedLead[] {
  try {
    return JSON.parse(localStorage.getItem("sinal-zero-saved-leads") ?? "[]") as SavedLead[];
  } catch {
    return [];
  }
}

function isLeadSaved(id: string): boolean {
  return getSavedLeads().some((lead) => lead.id === id);
}

function saveLead(lead: Establishment): void {
  const current = getSavedLeads();
  if (!current.some((item) => item.id === lead.id)) localStorage.setItem("sinal-zero-saved-leads", JSON.stringify([...current, lead]));
}

function removeLead(id: string): void {
  localStorage.setItem("sinal-zero-saved-leads", JSON.stringify(getSavedLeads().filter((lead) => lead.id !== id)));
}

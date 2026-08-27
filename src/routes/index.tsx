import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Map, Radar, Rows3 } from "lucide-react";
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

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Sinal Zero — Mapa de negócios" },
    { name: "description", content: "Encontre e qualifique negócios para prospecção." },
    { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
  ]}),
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
  return categories.some((category) => CATEGORIES[category].filters.some((filter) => {
    const value = lead.tags[filter.key];
    return Boolean(value && filter.values.includes(value));
  }));
}

function hasContact(lead: Establishment): boolean {
  return Boolean(lead.contact.whatsappValid || lead.contact.instagramUrl);
}

function hasWebsite(lead: Establishment): boolean {
  return Boolean(lead.signals.website || lead.contact.websiteUrl);
}

function MapSkeleton() {
  return <div className="flex h-full w-full items-center justify-center bg-muted/30"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
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

  useEffect(() => { setSavedLeads(getSavedLeads()); }, []);

  const filterByCategory = (leads: Establishment[], selected = categories) => leads.filter((lead) => categoryMatches(lead, selected));
  const applyPresenceFilter = (leads: Establishment[], signalZero: boolean, noWebsite: boolean) => leads.filter((lead) => { if (signalZero && lead.level !== "zero") return false; if (noWebsite && hasWebsite(lead)) return false; return true; });

  const verifyPresence = async (leads: Establishment[], scanId: number, signalZero: boolean, noWebsite: boolean, mode: VerificationMode) => {
    if (scanId !== scanIdRef.current) return;
    const localCandidates = applyPresenceFilter(leads, signalZero, noWebsite);
    setVerificationMode("off");
    setResults(localCandidates);
    setError(localCandidates.length === 0 ? (mode === "signal-zero" ? "Nenhum estabelecimento com Sinal Zero foi encontrado nessa pesquisa." : mode === "no-website" ? "Nenhum estabelecimento sem site foi encontrado nessa pesquisa." : "Nenhum estabelecimento satisfaz os filtros de presença selecionados.") : null);
    if (!localCandidates.length) return;
    try {
      const verified = await verifyLeadsServer({ data: { leads: localCandidates } });
      if (scanId !== scanIdRef.current) return;
      if (!verified.external) return;
      setVerificationMode("external");
      const refined = verified.leads.filter((lead) => {
        if (!lead.verification.checked) return true;
        if (signalZero && lead.verification.foundDigitalPresence) return false;
        if (noWebsite && lead.verification.foundWebsite) return false;
        return true;
      });
      setResults(refined);
      setError(refined.length === 0 ? "Nenhum lead passou pelos filtros de presença selecionados." : null);
    } catch { if (scanId === scanIdRef.current) setVerificationMode("off"); }
  };

  const runVerificationForCurrentFilters = (signalZero: boolean, noWebsite: boolean, source = allResults, selected = categories) => {
    const categoryResults = filterByCategory(source, selected);
    const scanId = ++scanIdRef.current;
    setError(null); setSelectedId(null);
    if (!signalZero && !noWebsite) { setVerificationMode("off"); setResults(categoryResults); setScanning(false); return; }
    setScanning(true);
    const mode: VerificationMode = signalZero && noWebsite ? "both" : signalZero ? "signal-zero" : "no-website";
    void verifyPresence(categoryResults, scanId, signalZero, noWebsite, mode).finally(() => { if (scanId === scanIdRef.current) setScanning(false); });
  };

  const runScan = async (target: PlaceSuggestion) => {
    const scanId = ++scanIdRef.current;
    setError(null); setScanning(true); setResults([]); setAllResults([]); setSelectedId(null); setCenter({ lat: target.lat, lon: target.lon }); setVerificationMode("off"); setMobileView("leads");
    const area = target.boundingBox ?? { south: target.lat - 0.05, north: target.lat + 0.05, west: target.lon - 0.05, east: target.lon + 0.05 };
    try {
      const data = await searchOverpassServer({ data: { area, categories } });
      if (scanId !== scanIdRef.current) return;
      const processed = processOverpassResults(data.elements, categories);
      setAllResults(processed);
      if (processed.length === 0) { setResults([]); setError("Nenhum estabelecimento foi encontrado nessa área para as categorias selecionadas."); return; }
      if (signalZeroOnly || noWebsiteOnly) {
        const mode: VerificationMode = signalZeroOnly && noWebsiteOnly ? "both" : signalZeroOnly ? "signal-zero" : "no-website";
        void verifyPresence(processed, scanId, signalZeroOnly, noWebsiteOnly, mode).finally(() => { if (scanId === scanIdRef.current) setScanning(false); });
      } else setResults(processed);
    } catch (err) { if (scanId !== scanIdRef.current) return; setError(err instanceof Error ? err.message : "Erro ao pesquisar a área."); }
    finally { if (scanId === scanIdRef.current && !signalZeroOnly && !noWebsiteOnly) setScanning(false); }
  };

  const handlePickPlace = (target: PlaceSuggestion) => { setPlace(target); setCenter({ lat: target.lat, lon: target.lon }); setError(null); };
  const handleScanCurrentPlace = () => { if (place) void runScan(place); else setError("Pesquise primeiro uma cidade, bairro ou local."); };
  const handleCategoriesChange = (next: CategoryKey[]) => { setCategories(next); setError(null); if (allResults.length > 0) { if (signalZeroOnly || noWebsiteOnly) runVerificationForCurrentFilters(signalZeroOnly, noWebsiteOnly, allResults, next); else setResults(filterByCategory(allResults, next)); } };
  const handleToggleSave = (lead: Establishment) => { if (isLeadSaved(lead.id)) removeLead(lead.id); else saveLead(lead); setSavedLeads(getSavedLeads()); };
  const handleSignalZeroChange = (enabled: boolean) => { setSignalZeroOnly(enabled); if (allResults.length > 0) runVerificationForCurrentFilters(enabled, noWebsiteOnly, allResults); };
  const handleNoWebsiteChange = (enabled: boolean) => { setNoWebsiteOnly(enabled); if (allResults.length > 0) runVerificationForCurrentFilters(signalZeroOnly, enabled, allResults); };

  const visibleResults = useMemo(() => {
    let list = results.filter((lead) => categoryMatches(lead, categories));
    if (contactOnly) list = list.filter(hasContact);
    list = list.filter((lead) => ratingMatchesFilter(lead.rating, ratingFilters));
    if (priceFilter !== "any") { const level = Number.parseInt(priceFilter, 10); list = list.filter((lead) => lead.priceLevel === level); }
    const sorted = [...list];
    sorted.sort((a,b) => { switch(sortKey){ case "rating_desc": return (b.rating??-1)-(a.rating??-1); case "rating_asc": return (a.rating??99)-(b.rating??99); case "price_desc": return (b.priceLevel??0)-(a.priceLevel??0); case "price_asc": return (a.priceLevel??99)-(b.priceLevel??99); case "name_asc": return a.name.localeCompare(b.name,"pt-BR"); default: return (a.signalCount-b.signalCount)||(Number(b.contactable)-Number(a.contactable))||((b.rating??-1)-(a.rating??-1))||a.name.localeCompare(b.name,"pt-BR"); }});
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
        <aside className={`relative z-20 flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-card/60 lg:h-auto lg:w-[460px] lg:flex-none lg:rounded-xl lg:border ${mobileView === "leads" ? "" : "hidden"} lg:flex`}><div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2.5"><div className="min-w-0"><h2 className="text-sm font-semibold">{signalZeroOnly && noWebsiteOnly ? "Sinal Zero + sem site" : signalZeroOnly ? "Sinais Zero" : noWebsiteOnly ? "Sem site" : "Estabelecimentos"}</h2></div><span className="text-xs text-muted-foreground">{visibleResults.length}</span></div><div className="min-h-0 flex-1 overflow-auto p-2"><Suspense fallback={<MapSkeleton />}><div className="space-y-2">{visibleResults.map((place) => <PlaceRow key={place.id} place={place} active={selectedId === place.id} saved={savedLeads.some((saved) => saved.id === place.id)} onSelect={() => setSelectedId(place.id)} onToggleSave={handleToggleSave} />)}</div></Suspense>{visibleResults.length === 0 && !scanning && <div className="p-6 text-center text-sm text-muted-foreground">{error ?? "Nenhum resultado para os filtros atuais."}</div>}{scanning && <div className="flex items-center justify-center p-6 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando...</div>}</div></aside>
        <section className={`relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-muted/20 ${mobileView === "map" ? "" : "hidden lg:block"}`}><ClientOnly fallback={<MapSkeleton />}><MapCanvas center={center} places={visibleResults} selectedId={selectedId} onSelect={setSelectedId} /></ClientOnly></section>
      </div>
    </div>
  );
}

export default Index;

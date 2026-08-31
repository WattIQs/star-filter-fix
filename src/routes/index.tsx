import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Radar, Search, Sparkles } from "lucide-react";
import { searchOverpassServer, verifyLeadsServer, type PlaceSuggestion } from "@/lib/geo.functions";
import { processOverpassResults } from "@/lib/lead-qualification";
import { getSavedLeads, isLeadSaved, removeLead, saveLead } from "@/lib/saved-leads";
import type { CategoryKey, Establishment, SavedLead, SortKey } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { CategoryMenu } from "@/components/sinal-zero/CategoryMenu";
import { FiltersMenu } from "@/components/sinal-zero/FiltersMenu";
import { PlaceRow } from "@/components/sinal-zero/PlaceRow";
import { PlaceSearchBar } from "@/components/sinal-zero/PlaceSearchBar";
import { SavedLeadsDrawer } from "@/components/sinal-zero/SavedLeadsDrawer";

type SignalFilter = "zero" | "weak" | "medium" | "high";
type ContactFilter = "whatsapp" | "instagram";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sinal Zero — Prospecção inteligente" },
      { name: "description", content: "Encontre e qualifique negócios para prospecção." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: Index,
});

const DEFAULT_CATEGORIES: CategoryKey[] = [];

function ratingMatchesFilter(rating: number | null, filters: string[]) {
  if (!filters.length) return true;
  if (rating === null) return filters.includes("unrated");
  return filters.some((filter) => filter !== "unrated" && Number.isFinite(Number.parseInt(filter, 10)) && Math.round(rating) === Number.parseInt(filter, 10));
}

function categoryMatches(lead: Establishment, categories: CategoryKey[]) {
  if (!categories.length) return true;
  if (lead.categoryKey && categories.includes(lead.categoryKey)) return true;
  return categories.some((category) => CATEGORIES[category].filters.some((filter) => {
    const value = lead.tags[filter.key];
    return Boolean(value && filter.values.includes(value));
  }));
}

function hasWebsite(lead: Establishment) { return Boolean(lead.signals.website || lead.contact.websiteUrl); }

function matchesSignalFilter(lead: Establishment, filters: SignalFilter[]) {
  if (!filters.length) return true;
  return filters.some((filter) => filter === "zero" ? lead.signalCount === 0 : filter === "weak" ? lead.signalCount === 1 : filter === "medium" ? lead.signalCount === 2 : lead.signalCount >= 3);
}

function matchesContactFilter(lead: Establishment, filters: ContactFilter[]) {
  if (!filters.length) return true;
  return filters.some((filter) => filter === "whatsapp" ? lead.contact.whatsappValid : Boolean(lead.contact.instagramUrl));
}

function applyPresenceFilters(leads: Establishment[], signalFilters: SignalFilter[], contactFilters: ContactFilter[], noWebsite: boolean) {
  return leads.filter((lead) => matchesSignalFilter(lead, signalFilters) && matchesContactFilter(lead, contactFilters) && (!noWebsite || !hasWebsite(lead)));
}

function Index() {
  const searchPlaces = useServerFn(searchOverpassServer);
  const verifyLeads = useServerFn(verifyLeadsServer);
  const [categories, setCategories] = useState<CategoryKey[]>(DEFAULT_CATEGORIES);
  const [ratingFilters, setRatingFilters] = useState<string[]>([]);
  const [priceFilter, setPriceFilter] = useState("any");
  const [signalFilters, setSignalFilters] = useState<SignalFilter[]>([]);
  const [contactFilters, setContactFilters] = useState<ContactFilter[]>([]);
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [scanning, setScanning] = useState(false);
  const [verifyingPresence, setVerifyingPresence] = useState(false);
  const [results, setResults] = useState<Establishment[]>([]);
  const [allResults, setAllResults] = useState<Establishment[]>([]);
  const [savedLeads, setSavedLeads] = useState<SavedLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [place, setPlace] = useState<PlaceSuggestion | null>(null);
  const scanIdRef = useRef(0);
  const filterRunRef = useRef(0);
  const verificationCacheRef = useRef(new globalThis.Map<string, Establishment>());

  useEffect(() => { setSavedLeads(getSavedLeads()); }, []);

  const filterByCategory = (leads: Establishment[], selected = categories) => leads.filter((lead) => categoryMatches(lead, selected));
  const applyCurrentFilters = (source: Establishment[], selectedCategories = categories, selectedSignals = signalFilters, selectedContacts = contactFilters, noWebsite = noWebsiteOnly) => {
    const next = applyPresenceFilters(filterByCategory(source, selectedCategories), selectedSignals, selectedContacts, noWebsite);
    setResults(next);
    setError(next.length === 0 && source.length > 0 ? "Nenhum resultado para os filtros atuais." : null);
  };

  const enrichPresence = async (source: Establishment[], scanId?: number): Promise<Establishment[] | null> => {
    const missing = source.filter((lead) => !verificationCacheRef.current.has(lead.id));
    if (!missing.length) return source.map((lead) => verificationCacheRef.current.get(lead.id) ?? lead);
    setVerifyingPresence(true); setError(null);
    try {
      const response = await verifyLeads({ data: { leads: missing } });
      if (scanId !== undefined && scanId !== scanIdRef.current) return null;
      for (const lead of response.leads) verificationCacheRef.current.set(lead.id, lead);
      if (!response.external) setError("Verificação externa indisponível: usando os dados do OpenStreetMap.");
      return source.map((lead) => verificationCacheRef.current.get(lead.id) ?? lead);
    } catch (err) {
      if (scanId === undefined || scanId === scanIdRef.current) setError(err instanceof Error ? err.message : "Não foi possível verificar a presença digital.");
      return null;
    } finally {
      if (scanId === undefined || scanId === scanIdRef.current) setVerifyingPresence(false);
    }
  };

  const refreshPresenceFilters = async (source: Establishment[], selectedCategories = categories, selectedSignals = signalFilters, selectedContacts = contactFilters, noWebsite = noWebsiteOnly) => {
    const runId = ++filterRunRef.current;
    const needsVerification = selectedSignals.length > 0 || selectedContacts.length > 0 || noWebsite;
    if (!needsVerification) { if (runId === filterRunRef.current) applyCurrentFilters(source, selectedCategories, selectedSignals, selectedContacts, noWebsite); return; }
    setResults([]);
    const enriched = await enrichPresence(source);
    if (runId !== filterRunRef.current) return;
    if (enriched) { setAllResults(enriched); applyCurrentFilters(enriched, selectedCategories, selectedSignals, selectedContacts, noWebsite); }
  };

  const runScan = async (target: PlaceSuggestion) => {
    const scanId = ++scanIdRef.current;
    filterRunRef.current += 1;
    verificationCacheRef.current.clear();
    setError(null); setScanning(true); setVerifyingPresence(false); setResults([]); setAllResults([]); setSelectedId(null);
    try {
      const data = await searchPlaces({ data: { area: target.boundingBox ?? { south: target.lat - 0.025, north: target.lat + 0.025, west: target.lon - 0.03, east: target.lon + 0.03 }, categories } });
      if (scanId !== scanIdRef.current) return;
      const processed = processOverpassResults(data.elements, categories);
      if (signalFilters.length || contactFilters.length || noWebsiteOnly) {
        const enriched = await enrichPresence(processed, scanId);
        if (scanId !== scanIdRef.current) return;
        if (enriched) { setAllResults(enriched); applyCurrentFilters(enriched, categories, signalFilters, contactFilters, noWebsiteOnly); }
      } else { setAllResults(processed); setResults(processed); }
      if (!processed.length) setError("Nenhum estabelecimento foi encontrado nessa área para as categorias selecionadas.");
    } catch (err) {
      if (scanId === scanIdRef.current) setError(err instanceof Error ? err.message : "Erro ao pesquisar a área.");
    } finally { if (scanId === scanIdRef.current) setScanning(false); }
  };

  const handlePickPlace = (target: PlaceSuggestion) => { setPlace(target); setError(null); };
  const handleScanCurrentPlace = () => { if (place) void runScan(place); else setError("Pesquise primeiro uma cidade, bairro ou local."); };
  const handleCategoriesChange = (next: CategoryKey[]) => { setCategories(next); setError(null); if (allResults.length) void refreshPresenceFilters(allResults, next, signalFilters, contactFilters, noWebsiteOnly); };
  const handleToggleSave = (lead: Establishment) => { if (isLeadSaved(lead.id)) removeLead(lead.id); else saveLead(lead); setSavedLeads(getSavedLeads()); };
  const handleSignalFiltersChange = (next: SignalFilter[]) => { setSignalFilters(next); if (allResults.length) void refreshPresenceFilters(allResults, categories, next, contactFilters, noWebsiteOnly); };
  const handleContactFiltersChange = (next: ContactFilter[]) => { setContactFilters(next); if (allResults.length) void refreshPresenceFilters(allResults, categories, signalFilters, next, noWebsiteOnly); };
  const handleNoWebsiteChange = (enabled: boolean) => { setNoWebsiteOnly(enabled); if (allResults.length) void refreshPresenceFilters(allResults, categories, signalFilters, contactFilters, enabled); };

  const visibleResults = useMemo(() => {
    let list = applyPresenceFilters(results.filter((lead) => categoryMatches(lead, categories)), signalFilters, contactFilters, noWebsiteOnly).filter((lead) => ratingMatchesFilter(lead.rating, ratingFilters));
    if (priceFilter !== "any") list = list.filter((lead) => lead.priceLevel === Number.parseInt(priceFilter, 10));
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "rating_desc": return (b.rating ?? -1) - (a.rating ?? -1);
        case "rating_asc": return (a.rating ?? 99) - (b.rating ?? 99);
        case "price_desc": return (b.priceLevel ?? 0) - (a.priceLevel ?? 0);
        case "price_asc": return (a.priceLevel ?? 99) - (b.priceLevel ?? 99);
        case "name_asc": return a.name.localeCompare(b.name, "pt-BR");
        default: return (b.rating ?? -1) - (a.rating ?? -1) || (a.signalCount - b.signalCount) || a.name.localeCompare(b.name, "pt-BR");
      }
    });
    return sorted;
  }, [results, categories, signalFilters, contactFilters, noWebsiteOnly, ratingFilters, priceFilter, sortKey]);

  const signalTitle = signalFilters.length === 0 ? "Estabelecimentos" : signalFilters.length === 1 ? `Sinal ${signalFilters[0] === "zero" ? "Zero" : signalFilters[0] === "weak" ? "Fraco" : signalFilters[0] === "medium" ? "Médio" : "Alto"}` : `${signalFilters.length} sinais selecionados`;
  const isBusy = scanning || verifyingPresence;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground lg:h-screen">
      <header className="relative z-[3000] shrink-0 border-b border-border bg-card/95 px-3 py-2.5 shadow-lg shadow-black/10 backdrop-blur-xl sm:px-5 lg:px-7">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_24px_-10px_var(--color-primary)]"><Radar className="h-5 w-5" /></div>
            <div className="leading-none"><div className="text-sm font-bold tracking-tight">Sinal <span className="text-gradient-signal">Zero</span></div><div className="mt-1 text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Prospecção inteligente</div></div>
          </div>
          <div className="min-w-0 flex-1"><PlaceSearchBar onPick={handlePickPlace} scanning={isBusy} currentLabel={place?.shortLabel ?? null} /></div>
          <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryMenu value={categories} onChange={handleCategoriesChange} onScan={handleScanCurrentPlace} scanning={isBusy} />
            <FiltersMenu ratingFilters={ratingFilters} onRatingFiltersChange={setRatingFilters} priceFilter={priceFilter} onPriceFilterChange={setPriceFilter} signalFilters={signalFilters} onSignalFiltersChange={handleSignalFiltersChange} contactFilters={contactFilters} onContactFiltersChange={handleContactFiltersChange} noWebsiteOnly={noWebsiteOnly} onNoWebsiteOnlyChange={handleNoWebsiteChange} sortKey={sortKey} onSortKeyChange={setSortKey} />
            <SavedLeadsDrawer leads={savedLeads} onRemove={(id) => { removeLead(id); setSavedLeads(getSavedLeads()); }} />
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-5 lg:px-7 lg:py-5">
        <div className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-4">
          <section className="panel-enter rounded-2xl border border-border bg-card/75 p-4 shadow-xl shadow-black/10 backdrop-blur-xl sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary"><Sparkles className="h-3.5 w-3.5" />Área de prospecção</div><h1 className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">Encontre empresas com potencial</h1><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Pesquise uma região, escolha as categorias e qualifique os estabelecimentos por reputação, presença digital e sinais de contato.</p></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-center"><div className="text-lg font-bold text-foreground">{visibleResults.length}</div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Resultados</div></div><div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-center"><div className="text-lg font-bold text-signal-zero">{savedLeads.length}</div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Salvos</div></div><div className="hidden rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-center sm:block"><div className="text-lg font-bold text-cyan">{categories.length || "Todas"}</div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Categorias</div></div></div>
            </div>
          </section>

          <section className="panel-enter min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card/55 shadow-xl shadow-black/10 backdrop-blur-xl">
            <div className="flex flex-col gap-2 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div><h2 className="text-sm font-semibold">{signalTitle}{contactFilters.length ? ` · ${contactFilters.map((item) => item === "whatsapp" ? "WhatsApp" : "Instagram").join(" + ")}` : ""}{noWebsiteOnly ? " · sem site" : ""}</h2><p className="mt-0.5 text-[10px] text-muted-foreground">{place ? `Área: ${place.shortLabel}` : "Selecione uma área para começar"}</p></div>
              <div className="flex items-center gap-2"><span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{visibleResults.length} encontrados</span>{isBusy && <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-[10px] font-medium text-primary"><Search className="h-3 w-3 animate-pulse" />Processando</span>}</div>
            </div>

            <div className="min-h-[320px] p-3 sm:p-4">
              {isBusy && <div className="loading-state-enter flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-primary/10 bg-background/30 p-6 text-center" role="status" aria-live="polite"><div className="loading-state-spinner" aria-hidden="true"/><span className="loading-state-title mt-4">{scanning ? "Pesquisando a área..." : "Verificando presença digital..."}</span><span className="loading-state-subtitle">Aguarde enquanto os estabelecimentos são qualificados.</span></div>}
              {!isBusy && visibleResults.length === 0 && <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/25 p-8 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/8 text-primary"><Radar className="h-6 w-6" /></div><h3 className="mt-4 text-sm font-semibold">{error ?? "Pronto para encontrar novos leads"}</h3><p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{error ? "Ajuste os filtros ou pesquise outra área." : "Pesquise uma cidade, bairro ou região acima e clique em Varrer área."}</p></div>}
              {!isBusy && visibleResults.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visibleResults.map((item, index) => <PlaceRow key={item.id} place={item} active={selectedId === item.id} saved={savedLeads.some((saved) => saved.id === item.id)} animationDelay={Math.min(index, 14) * 55} onSelect={() => setSelectedId(item.id)} onToggleSave={handleToggleSave} />)}</div>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Index;

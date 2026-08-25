import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
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
      {
        name: "description",
        content:
          "Mapa gratuito de prospecção: encontre restaurantes, barbearias, pet shops, lojas e mercados sem site ou Instagram, com filtros de nota, preço e contato por WhatsApp.",
      },
      {
        property: "og:title",
        content: "Sinal Zero — Mapa de negócios sem presença digital",
      },
      {
        property: "og:description",
        content:
          "Mapa gratuito de prospecção com filtros de nota, preço e categoria, e contato direto por WhatsApp ou Instagram.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const DEFAULT_CATEGORIES: CategoryKey[] = [];

/** Limita a área varrida para o Overpass não estourar em estados/países inteiros. */
const MAX_SPAN = 0.18;

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function Index() {
  const [categories, setCategories] = useState<CategoryKey[]>(DEFAULT_CATEGORIES);
  const [minRating, setMinRating] = useState<string>("any");
  const [priceFilter, setPriceFilter] = useState<string>("any");
  const [presenceFilter, setPresenceFilter] = useState<string>("any");
  const [sortKey, setSortKey] = useState<SortKey>("relevance");

  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<Establishment[]>([]);
  const [savedLeads, setSavedLeads] = useState<SavedLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [place, setPlace] = useState<PlaceSuggestion | null>(null);

  useEffect(() => {
    setSavedLeads(getSavedLeads());
  }, []);

  const runScan = async (target: PlaceSuggestion, cats: CategoryKey[]) => {
    if (cats.length === 0) {
      setError("Escolha pelo menos uma categoria no menu Categorias.");
      return;
    }

    setError(null);
    setScanning(true);
    setResults([]);
    setSelectedId(null);
    setCenter({ lat: target.lat, lon: target.lon });

    try {
      const bb = target.boundingBox;
      const half = MAX_SPAN / 2;
      const area = {
        south: Math.max(bb?.south ?? -90, target.lat - half),
        north: Math.min(bb?.north ?? 90, target.lat + half),
        west: Math.max(bb?.west ?? -180, target.lon - half),
        east: Math.min(bb?.east ?? 180, target.lon + half),
      };

      const data = await searchOverpassServer({ data: { area, categories: cats } });
      const processed = processOverpassResults(data.elements, cats);
      setResults(processed);
      if (processed.length === 0) {
        setError("Nenhum estabelecimento encontrado aqui. Tente outra categoria ou outro local.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao escanear área.");
    } finally {
      setScanning(false);
    }
  };

  const handlePickPlace = (target: PlaceSuggestion) => {
    setPlace(target);
    void runScan(target, categories);
  };

  const handleCategoriesChange = (next: CategoryKey[]) => {
    setCategories(next);
    if (place) void runScan(place, next);
  };

  const handleToggleSave = (lead: Establishment) => {
    if (isLeadSaved(lead.id)) removeLead(lead.id);
    else saveLead(lead);
    setSavedLeads(getSavedLeads());
  };

  const visibleResults = useMemo(() => {
    const order: Record<"zero" | "weak" | "full", number> = { zero: 0, weak: 1, full: 2 };
    // Sempre apenas estabelecimentos contatáveis (WhatsApp válido ou Instagram)
    let list = results.filter(
      (r) => r.contact.whatsappValid || Boolean(r.contact.instagramUrl)
    );

    if (minRating !== "any") {
      const min = Number.parseFloat(minRating);
      list = list.filter((r) => r.rating !== null && r.rating >= min);
    }
    if (priceFilter !== "any") {
      const level = Number.parseInt(priceFilter, 10);
      list = list.filter((r) => r.priceLevel === level);
    }
    if (presenceFilter === "weak") {
      list = list.filter((r) => r.level !== "full");
    }
    if (presenceFilter === "zero") {
      list = list.filter((r) => r.level === "zero");
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "rating_desc":
          return (b.rating ?? -1) - (a.rating ?? -1);
        case "rating_asc":
          return (a.rating ?? 99) - (b.rating ?? 99);
        case "price_desc":
          return (b.priceLevel ?? 0) - (a.priceLevel ?? 0);
        case "price_asc":
          return (a.priceLevel ?? 99) - (b.priceLevel ?? 99);
        case "name_asc":
          return a.name.localeCompare(b.name, "pt-BR");
        default:
          if (a.contactable !== b.contactable) return a.contactable ? -1 : 1;
          return order[a.level] - order[b.level];
      }
    });
    return sorted;
  }, [results, minRating, priceFilter, presenceFilter, sortKey]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Barra superior: logo, busca de lugares, menus ocultos */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-card/80 px-3 py-2 backdrop-blur sm:gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <Radar className="h-5 w-5 text-signal-zero" />
          <span className="hidden text-sm font-bold tracking-tight sm:inline">
            Sinal <span className="text-gradient-signal">Zero</span>
          </span>
        </div>

        <PlaceSearchBar
          onPick={handlePickPlace}
          scanning={scanning}
          currentLabel={place?.shortLabel ?? null}
        />

        <CategoryMenu value={categories} onChange={handleCategoriesChange} />

        <FiltersMenu
          minRating={minRating}
          onMinRatingChange={setMinRating}
          priceFilter={priceFilter}
          onPriceFilterChange={setPriceFilter}
          presenceFilter={presenceFilter}
          onPresenceFilterChange={setPresenceFilter}
          sortKey={sortKey}
          onSortKeyChange={setSortKey}
        />

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <SavedLeadsDrawer
            leads={savedLeads}
            onRemove={(id) => {
              removeLead(id);
              setSavedLeads(getSavedLeads());
            }}
          />
          <ExportCsvButton />
        </div>
      </header>

      {/* Lista à esquerda + mapa à direita */}
      <div className="flex min-h-0 flex-1 flex-col gap-0 p-0 lg:flex-row lg:gap-3 lg:p-3">
        <aside className="flex h-1/2 min-h-0 w-full flex-col overflow-hidden border-b border-border bg-card/40 lg:h-auto lg:w-[460px] lg:shrink-0 lg:rounded-xl lg:border">
          <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2.5">
            <h2 className="text-sm font-semibold">Resultados</h2>
            <span className="text-[11px] text-muted-foreground">
              {visibleResults.length} de {results.length}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {scanning ? (
              <div className="space-y-2 px-4 py-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-md border border-border/50 bg-muted/40"
                  />
                ))}
              </div>
            ) : error ? (
              <p className="px-4 py-6 text-xs text-destructive">{error}</p>
            ) : visibleResults.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground">
                {results.length === 0
                  ? "Busque uma cidade, bairro ou rua na barra de pesquisa para varrer a área."
                  : "Nenhum estabelecimento contatável (WhatsApp ou Instagram) passou nos filtros atuais."}
              </p>
            ) : (
              visibleResults.map((item) => (
                <PlaceRow
                  key={item.id}
                  place={item}
                  active={item.id === selectedId}
                  saved={savedLeads.some((l) => l.id === item.id)}
                  onSelect={setSelectedId}
                  onToggleSave={handleToggleSave}
                />
              ))
            )}
          </div>
        </aside>

        <main className="relative min-h-0 flex-1 overflow-hidden border-t border-border lg:rounded-xl lg:border lg:shadow-lg">
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <MapCanvas
                places={visibleResults}
                selectedId={selectedId}
                onSelect={setSelectedId}
                center={center}
              />
            </Suspense>
          </ClientOnly>

          {scanning && (
            <div className="absolute left-1/2 top-3 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] text-muted-foreground shadow-lg">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Varrendo a área...
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { searchPlacesServer, type PlaceSuggestion } from "@/lib/geo.functions";
import { resolveMunicipalityServer, searchMunicipalitiesServer, type MunicipalitySuggestion } from "@/lib/municipality-search";
import { cn } from "@/lib/utils";

interface PlaceSearchBarProps {
  onPick: (place: PlaceSuggestion) => void;
  scanning: boolean;
  currentLabel: string | null;
}

type SearchSuggestion =
  | { kind: "municipality"; value: MunicipalitySuggestion }
  | { kind: "place"; value: PlaceSuggestion };

export function PlaceSearchBar({ onPick, scanning, currentLabel }: PlaceSearchBarProps) {
  const searchMunicipalities = useServerFn(searchMunicipalitiesServer);
  const resolveMunicipality = useServerFn(resolveMunicipalityServer);
  const searchPlaces = useServerFn(searchPlacesServer);
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const pickedLabelRef = useRef<string | null>(null);

  useEffect(() => {
    if (pickedLabelRef.current !== null && value === pickedLabelRef.current) return;
    const term = value.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const id = ++requestIdRef.current;
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const municipalities = await searchMunicipalities({ data: { q: term } });
        if (cancelled || id !== requestIdRef.current) return;

        if (municipalities.length > 0) {
          setSuggestions(municipalities.map((item) => ({ kind: "municipality", value: item })));
          setHighlight(0);
          setOpen(true);
          return;
        }

        const places = await searchPlaces({ data: { q: term } });
        if (cancelled || id !== requestIdRef.current) return;
        setSuggestions(places.map((item) => ({ kind: "place", value: item })));
        setHighlight(0);
        setOpen(places.length > 0);
      } catch {
        if (!cancelled && id === requestIdRef.current) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (!cancelled && id === requestIdRef.current) setLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, searchMunicipalities, searchPlaces]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pick = async (suggestion: SearchSuggestion) => {
    if (suggestion.kind === "place") {
      const place = suggestion.value;
      pickedLabelRef.current = place.shortLabel;
      setSuggestions([]);
      setValue(place.shortLabel);
      setOpen(false);
      onPick(place);
      return;
    }

    const municipality = suggestion.value;
    setLoading(true);
    setOpen(false);
    try {
      const resolved = await resolveMunicipality({ data: { name: municipality.name, uf: municipality.uf } });
      if (!resolved) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      pickedLabelRef.current = resolved.shortLabel;
      setSuggestions([]);
      setValue(resolved.shortLabel);
      onPick(resolved);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (event.key === "Escape") setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const suggestion = suggestions[highlight];
      if (suggestion) void pick(suggestion);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
        {scanning || loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
      </span>
      <input
        value={value}
        onChange={(event) => {
          pickedLabelRef.current = null;
          setValue(event.target.value);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={currentLabel ?? "Buscar cidade, estado, bairro ou endereço"}
        aria-label="Buscar lugar no mapa"
        autoComplete="off"
        inputMode="search"
        className="h-10 w-full rounded-full border border-border bg-background/95 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10 sm:h-9 sm:text-xs"
      />
      {open && value !== pickedLabelRef.current && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-[900] origin-top overflow-hidden rounded-2xl border border-border bg-popover/98 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-[10px] font-medium text-muted-foreground">
            <span>Selecione o local correto antes de varrer</span>
            <span>{suggestions.length} resultado{suggestions.length === 1 ? "" : "s"}</span>
          </div>
          <ul className="max-h-[min(18rem,55vh)] overflow-y-auto overscroll-contain">
            {suggestions.map((suggestion, index) => {
              if (suggestion.kind === "municipality") {
                const municipality = suggestion.value;
                return (
                  <li key={`${municipality.id}-${municipality.uf}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => void pick(suggestion)}
                      className={cn(
                        "flex min-h-12 w-full items-start gap-2 px-3 py-2.5 text-left transition-all duration-100 active:scale-[.99]",
                        index === highlight ? "bg-muted" : "hover:bg-muted/60",
                      )}
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-foreground sm:text-sm">{municipality.shortLabel}</span>
                        <span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-muted-foreground sm:text-[11px]">Município brasileiro · IBGE</span>
                      </span>
                    </button>
                  </li>
                );
              }

              const place = suggestion.value;
              return (
                <li key={`${place.lat}-${place.lon}-${index}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => void pick(suggestion)}
                    className={cn(
                      "flex min-h-12 w-full items-start gap-2 px-3 py-2.5 text-left transition-all duration-100 active:scale-[.99]",
                      index === highlight ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-foreground sm:text-sm">{place.shortLabel}</span>
                      <span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-muted-foreground sm:text-[11px]">{place.label}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

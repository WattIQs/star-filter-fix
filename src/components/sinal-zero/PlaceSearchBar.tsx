import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { searchPlacesServer, type PlaceSuggestion } from "@/lib/geo.functions";
import { cn } from "@/lib/utils";

interface PlaceSearchBarProps {
  onPick: (place: PlaceSuggestion) => void;
  scanning: boolean;
  currentLabel: string | null;
}

export function PlaceSearchBar({ onPick, scanning, currentLabel }: PlaceSearchBarProps) {
  const searchPlaces = useServerFn(searchPlacesServer);
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
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

    const requestId = ++requestIdRef.current;
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      searchPlaces({ data: { q: term } })
        .then((list) => {
          if (cancelled || requestId !== requestIdRef.current) return;
          setSuggestions(list);
          setHighlight(0);
          setOpen(list.length > 0);
        })
        .catch(() => {
          if (!cancelled && requestId === requestIdRef.current) {
            setSuggestions([]);
            setOpen(false);
          }
        })
        .finally(() => {
          if (!cancelled && requestId === requestIdRef.current) setLoading(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, searchPlaces]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const pick = (place: PlaceSuggestion) => {
    pickedLabelRef.current = place.shortLabel;
    setSuggestions([]);
    setValue(place.shortLabel);
    setOpen(false);
    onPick(place);
  };

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {scanning || loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
      </span>
      <input
        value={value}
        onChange={(e) => {
          pickedLabelRef.current = null;
          setValue(e.target.value);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const place = suggestions[highlight];
            if (place) pick(place);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={currentLabel ?? "Buscar cidade, estado, país, bairro ou rua"}
        aria-label="Buscar lugar no mapa"
        autoComplete="off"
        className="h-9 w-full rounded-full border border-border bg-background pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20"
      />

      {open && value !== pickedLabelRef.current && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-[900] overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          <div className="border-b border-border/60 px-3 py-2 text-[10px] font-medium text-muted-foreground">
            Sugestões de locais
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {suggestions.map((place, i) => (
              <li key={`${place.lat}-${place.lon}-${i}`}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(place)}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2.5 text-left text-xs transition-colors",
                    i === highlight ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{place.shortLabel}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{place.label}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

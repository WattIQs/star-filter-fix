import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SORT_LABELS, type SortKey } from "@/lib/types";

interface FiltersMenuProps {
  minRating: string;
  onMinRatingChange: (value: string) => void;
  priceFilter: string;
  onPriceFilterChange: (value: string) => void;
  presenceFilter: string;
  onPresenceFilterChange: (value: string) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
}

export function FiltersMenu({
  minRating,
  onMinRatingChange,
  priceFilter,
  onPriceFilterChange,
  presenceFilter,
  onPresenceFilterChange,
  sortKey,
  onSortKeyChange,
}: FiltersMenuProps) {
  const activeCount =
    (minRating !== "any" ? 1 : 0) +
    (priceFilter !== "any" ? 1 : 0) +
    (presenceFilter !== "any" ? 1 : 0) +
    (sortKey !== "relevance" ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filtros</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
              {activeCount}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3 p-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Classificação
          </Label>
          <Select value={minRating} onValueChange={onMinRatingChange}>
            <SelectTrigger className="h-9 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer classificação</SelectItem>
              <SelectItem value="2">2 estrelas ou mais</SelectItem>
              <SelectItem value="3">3 estrelas ou mais</SelectItem>
              <SelectItem value="4">4 estrelas ou mais</SelectItem>
              <SelectItem value="4.5">4,5 estrelas ou mais</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Preço
          </Label>
          <Select value={priceFilter} onValueChange={onPriceFilterChange}>
            <SelectTrigger className="h-9 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer preço</SelectItem>
              <SelectItem value="1">$ · Preço baixo</SelectItem>
              <SelectItem value="2">$$ · Preço médio</SelectItem>
              <SelectItem value="3">$$$ · Preço alto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Presença digital
          </Label>
          <Select value={presenceFilter} onValueChange={onPresenceFilterChange}>
            <SelectTrigger className="h-9 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Todos os estabelecimentos</SelectItem>
              <SelectItem value="weak">Apenas presença fraca ou nula</SelectItem>
              <SelectItem value="zero">Apenas sinal zero (sem nada)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Ordenar por
          </Label>
          <Select value={sortKey} onValueChange={(v) => onSortKeyChange(v as SortKey)}>
            <SelectTrigger className="h-9 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <button
          type="button"
          onClick={() => {
            onMinRatingChange("any");
            onPriceFilterChange("any");
            onPresenceFilterChange("any");
            onSortKeyChange("relevance");
          }}
          className="w-full rounded-md border border-border py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
        >
          Limpar filtros
        </button>
      </PopoverContent>
    </Popover>
  );
}

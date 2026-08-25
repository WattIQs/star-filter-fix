import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SORT_LABELS, type SortKey } from "@/lib/types";

interface FiltersMenuProps {
  ratingFilter: string;
  onRatingFilterChange: (value: string) => void;
  priceFilter: string;
  onPriceFilterChange: (value: string) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
}

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full cursor-pointer rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none transition-colors hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function FiltersMenu({ ratingFilter, onRatingFilterChange, priceFilter, onPriceFilterChange, sortKey, onSortKeyChange }: FiltersMenuProps) {
  const activeCount = (ratingFilter !== "any" ? 1 : 0) + (priceFilter !== "any" ? 1 : 0) + (sortKey !== "relevance" ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative z-[1201] shrink-0 gap-1.5 border-border bg-background text-xs shadow-sm hover:bg-accent">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filtros</span>
          {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{activeCount}</span>}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} collisionPadding={12} className="z-[5000] w-[300px] space-y-4 border-border bg-card p-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div><h3 className="text-sm font-semibold text-foreground">Filtros</h3><p className="mt-0.5 text-[10px] text-muted-foreground">Aplicados aos sinais zero encontrados</p></div>
          {activeCount > 0 && <button type="button" onClick={() => { onRatingFilterChange("any"); onPriceFilterChange("any"); onSortKeyChange("relevance"); }} className="text-[11px] font-medium text-primary hover:underline">Limpar</button>}
        </div>
        <FilterSelect label="Classificação" value={ratingFilter} onChange={onRatingFilterChange} options={[{ value: "any", label: "Qualquer classificação" }, { value: "1", label: "1 estrela" }, { value: "2", label: "2 estrelas" }, { value: "3", label: "3 estrelas" }, { value: "4", label: "4 estrelas" }, { value: "5", label: "5 estrelas" }, { value: "unrated", label: "Sem nota pública" }]} />
        <FilterSelect label="Preço" value={priceFilter} onChange={onPriceFilterChange} options={[{ value: "any", label: "Qualquer preço" }, { value: "1", label: "$ · Preço baixo" }, { value: "2", label: "$$ · Preço médio" }, { value: "3", label: "$$$ · Preço alto" }]} />
        <FilterSelect label="Ordenar por" value={sortKey} onChange={(value) => onSortKeyChange(value as SortKey)} options={(Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({ value: key, label: SORT_LABELS[key] }))} />
      </PopoverContent>
    </Popover>
  );
}

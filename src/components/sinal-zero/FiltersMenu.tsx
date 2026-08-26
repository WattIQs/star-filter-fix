import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SORT_LABELS, type SortKey } from "@/lib/types";

interface FiltersMenuProps {
  ratingFilters: string[];
  onRatingFiltersChange: (value: string[]) => void;
  priceFilter: string;
  onPriceFilterChange: (value: string) => void;
  signalZeroOnly: boolean;
  onSignalZeroOnlyChange: (value: boolean) => void;
  contactOnly: boolean;
  onContactOnlyChange: (value: boolean) => void;
  websiteOnly: boolean;
  onWebsiteOnlyChange: (value: boolean) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
}

const RATING_OPTIONS = [
  { value: "1", label: "1 estrela" },
  { value: "2", label: "2 estrelas" },
  { value: "3", label: "3 estrelas" },
  { value: "4", label: "4 estrelas" },
  { value: "5", label: "5 estrelas" },
  { value: "unrated", label: "Sem nota pública" },
];

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="block space-y-1.5"><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full cursor-pointer rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none transition-colors hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function FilterToggle({ checked, onChange, title, description }: { checked: boolean; onChange: (value: boolean) => void; title: string; description: string }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 bg-muted/30 px-3 py-3 transition-colors hover:bg-muted/50"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer accent-primary" /><span><span className="block text-xs font-semibold text-foreground">{title}</span><span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{description}</span></span></label>;
}

function HiddenFilterGroup({ title, summary, open, onToggle, children }: { title: string; summary: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className="rounded-lg border border-border/70 bg-muted/10">
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/30">
      <span className="min-w-0"><span className="block text-xs font-semibold text-foreground">{title}</span><span className="block truncate text-[10px] text-muted-foreground">{summary}</span></span>
      {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </button>
    {open && <div className="space-y-2 border-t border-border/60 p-3">{children}</div>}
  </div>;
}

function MultiRatingFilter({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const toggle = (value: string) => {
    const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
    onChange(next);
  };

  return <HiddenFilterGroup
    title="Classificação"
    summary={values.length === 0 ? "Qualquer classificação" : `${values.length} selecionada${values.length > 1 ? "s" : ""}`}
    open={false}
    onToggle={() => undefined}
  >{null}</HiddenFilterGroup>;
}

export function FiltersMenu({ ratingFilters, onRatingFiltersChange, priceFilter, onPriceFilterChange, signalZeroOnly, onSignalZeroOnlyChange, contactOnly, onContactOnlyChange, websiteOnly, onWebsiteOnlyChange, sortKey, onSortKeyChange }: FiltersMenuProps) {
  const [searchGroupOpen, setSearchGroupOpen] = useState(false);
  const [ratingGroupOpen, setRatingGroupOpen] = useState(false);
  const activeCount = ratingFilters.length + (priceFilter !== "any" ? 1 : 0) + (signalZeroOnly ? 1 : 0) + (contactOnly ? 1 : 0) + (websiteOnly ? 1 : 0) + (sortKey !== "relevance" ? 1 : 0);
  const ratingSummary = ratingFilters.length === 0 ? "Qualquer classificação" : ratingFilters.map((value) => RATING_OPTIONS.find((option) => option.value === value)?.label ?? value).join(", ");
  const searchCount = Number(signalZeroOnly) + Number(contactOnly) + Number(websiteOnly);

  return <Popover>
    <PopoverTrigger asChild><Button variant="outline" size="sm" className="relative z-[1201] shrink-0 gap-1.5 border-border bg-background text-xs shadow-sm hover:bg-accent"><SlidersHorizontal className="h-3.5 w-3.5" /><span>Filtro de busca</span>{activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{activeCount}</span>}<ChevronDown className="h-3.5 w-3.5 opacity-70" /></Button></PopoverTrigger>
    <PopoverContent align="end" sideOffset={8} collisionPadding={12} className="z-[5000] w-[340px] space-y-3 border-border bg-card p-4 shadow-2xl">
      <div className="flex items-center justify-between border-b border-border pb-3"><div><h3 className="text-sm font-semibold text-foreground">Filtro de busca</h3><p className="mt-0.5 text-[10px] text-muted-foreground">Combine alternativas para encontrar exatamente o lead desejado.</p></div>{activeCount > 0 && <button type="button" onClick={() => { onRatingFiltersChange([]); onPriceFilterChange("any"); onSignalZeroOnlyChange(false); onContactOnlyChange(false); onWebsiteOnlyChange(false); onSortKeyChange("relevance"); }} className="text-[11px] font-medium text-primary hover:underline">Limpar</button>}</div>

      <HiddenFilterGroup title="Busca e presença" summary={searchCount === 0 ? "Qualquer estabelecimento" : `${searchCount} filtro${searchCount > 1 ? "s" : ""} ativo${searchCount > 1 ? "s" : ""}`} open={searchGroupOpen} onToggle={() => setSearchGroupOpen((open) => !open)}>
        <FilterToggle checked={signalZeroOnly} onChange={onSignalZeroOnlyChange} title="Somente Sinal Zero" description="Confirma ausência de presença digital comercial; candidatos não confirmados não entram." />
        <FilterToggle checked={contactOnly} onChange={onContactOnlyChange} title="Contato: WhatsApp ou Instagram" description="Exige WhatsApp válido ou Instagram identificado para o estabelecimento." />
        <FilterToggle checked={websiteOnly} onChange={onWebsiteOnlyChange} title="Presença de site" description="Exige um site identificado e associado ao estabelecimento." />
      </HiddenFilterGroup>

      <div className="rounded-lg border border-border/70 bg-muted/10">
        <button type="button" onClick={() => setRatingGroupOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/30">
          <span className="min-w-0"><span className="block text-xs font-semibold text-foreground">Classificação</span><span className="block truncate text-[10px] text-muted-foreground">{ratingSummary}</span></span>
          {ratingGroupOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </button>
        {ratingGroupOpen && <div className="grid grid-cols-2 gap-2 border-t border-border/60 p-3">
          {RATING_OPTIONS.map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-2 text-xs hover:bg-muted/40"><input type="checkbox" checked={ratingFilters.includes(option.value)} onChange={() => { const next = ratingFilters.includes(option.value) ? ratingFilters.filter((item) => item !== option.value) : [...ratingFilters, option.value]; onRatingFiltersChange(next); }} className="h-4 w-4 cursor-pointer accent-primary" />{option.label}</label>)}
        </div>}
      </div>

      <FilterSelect label="Preço" value={priceFilter} onChange={onPriceFilterChange} options={[{ value: "any", label: "Qualquer preço" }, { value: "1", label: "$ · Preço baixo" }, { value: "2", label: "$$ · Preço médio" }, { value: "3", label: "$$$ · Preço alto" }]} />
      <FilterSelect label="Ordenar por" value={sortKey} onChange={(value) => onSortKeyChange(value as SortKey)} options={(Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({ value: key, label: SORT_LABELS[key] }))} />
    </PopoverContent>
  </Popover>;
}

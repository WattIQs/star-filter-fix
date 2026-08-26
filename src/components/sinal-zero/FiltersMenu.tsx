import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SORT_LABELS, type SortKey } from "@/lib/types";

interface FiltersMenuProps {
  ratingFilter: string;
  onRatingFilterChange: (value: string) => void;
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

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="block space-y-1.5"><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full cursor-pointer rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none transition-colors hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function FilterToggle({ checked, onChange, title, description }: { checked: boolean; onChange: (value: boolean) => void; title: string; description: string }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 bg-muted/30 px-3 py-3 transition-colors hover:bg-muted/50"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer accent-primary" /><span><span className="block text-xs font-semibold text-foreground">{title}</span><span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{description}</span></span></label>;
}

export function FiltersMenu({ ratingFilter, onRatingFilterChange, priceFilter, onPriceFilterChange, signalZeroOnly, onSignalZeroOnlyChange, contactOnly, onContactOnlyChange, websiteOnly, onWebsiteOnlyChange, sortKey, onSortKeyChange }: FiltersMenuProps) {
  const activeCount = (ratingFilter !== "any" ? 1 : 0) + (priceFilter !== "any" ? 1 : 0) + (signalZeroOnly ? 1 : 0) + (contactOnly ? 1 : 0) + (websiteOnly ? 1 : 0) + (sortKey !== "relevance" ? 1 : 0);
  return <Popover>
    <PopoverTrigger asChild><Button variant="outline" size="sm" className="relative z-[1201] shrink-0 gap-1.5 border-border bg-background text-xs shadow-sm hover:bg-accent"><SlidersHorizontal className="h-3.5 w-3.5" /><span>Filtro de busca</span>{activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{activeCount}</span>}<ChevronDown className="h-3.5 w-3.5 opacity-70" /></Button></PopoverTrigger>
    <PopoverContent align="end" sideOffset={8} collisionPadding={12} className="z-[5000] w-[320px] space-y-4 border-border bg-card p-4 shadow-2xl">
      <div className="flex items-center justify-between border-b border-border pb-3"><div><h3 className="text-sm font-semibold text-foreground">Filtro de busca</h3><p className="mt-0.5 text-[10px] text-muted-foreground">Escolha exatamente o tipo de lead que deseja encontrar.</p></div>{activeCount > 0 && <button type="button" onClick={() => { onRatingFilterChange("any"); onPriceFilterChange("any"); onSignalZeroOnlyChange(false); onContactOnlyChange(false); onWebsiteOnlyChange(false); onSortKeyChange("relevance"); }} className="text-[11px] font-medium text-primary hover:underline">Limpar</button>}</div>
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Presença e contato</p>
        <FilterToggle checked={signalZeroOnly} onChange={onSignalZeroOnlyChange} title="Somente Sinal Zero" description="Exige ausência de presença digital comercial confirmada. A verificação externa é obrigatória quando disponível; candidatos não confirmados não entram." />
        <FilterToggle checked={contactOnly} onChange={onContactOnlyChange} title="Contato: WhatsApp ou Instagram" description="Mostra apenas leads com WhatsApp válido ou Instagram identificado." />
        <FilterToggle checked={websiteOnly} onChange={onWebsiteOnlyChange} title="Presença de site" description="Mostra apenas negócios com um site identificado para o estabelecimento." />
      </div>
      <FilterSelect label="Classificação" value={ratingFilter} onChange={onRatingFilterChange} options={[{ value: "any", label: "Qualquer classificação" }, { value: "1", label: "1 estrela" }, { value: "2", label: "2 estrelas" }, { value: "3", label: "3 estrelas" }, { value: "4", label: "4 estrelas" }, { value: "5", label: "5 estrelas" }, { value: "unrated", label: "Sem nota pública" }]} />
      <FilterSelect label="Preço" value={priceFilter} onChange={onPriceFilterChange} options={[{ value: "any", label: "Qualquer preço" }, { value: "1", label: "$ · Preço baixo" }, { value: "2", label: "$$ · Preço médio" }, { value: "3", label: "$$$ · Preço alto" }]} />
      <FilterSelect label="Ordenar por" value={sortKey} onChange={(value) => onSortKeyChange(value as SortKey)} options={(Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({ value: key, label: SORT_LABELS[key] }))} />
    </PopoverContent>
  </Popover>;
}

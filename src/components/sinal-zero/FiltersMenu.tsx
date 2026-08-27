import { Check, ChevronDown, ChevronRight, CircleDot, Instagram, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SORT_LABELS, type SortKey } from "@/lib/types";

type SignalFilter = "zero" | "weak" | "medium" | "high";
type ContactFilter = "whatsapp" | "instagram";

interface FiltersMenuProps {
  ratingFilters: string[];
  onRatingFiltersChange: (value: string[]) => void;
  priceFilter: string;
  onPriceFilterChange: (value: string) => void;
  signalFilters: SignalFilter[];
  onSignalFiltersChange: (value: SignalFilter[]) => void;
  contactFilters: ContactFilter[];
  onContactFiltersChange: (value: ContactFilter[]) => void;
  noWebsiteOnly: boolean;
  onNoWebsiteOnlyChange: (value: boolean) => void;
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

const PRICE_OPTIONS = [
  { value: "any", label: "Qualquer preço" },
  { value: "1", label: "$ · Preço baixo" },
  { value: "2", label: "$$ · Preço médio" },
  { value: "3", label: "$$$ · Preço alto" },
];

const SIGNAL_OPTIONS: Array<{ value: SignalFilter; label: string; detail: string }> = [
  { value: "zero", label: "Sinal Zero", detail: "0 canais" },
  { value: "weak", label: "Sinal Fraco", detail: "1 canal" },
  { value: "medium", label: "Sinal Médio", detail: "2 canais" },
  { value: "high", label: "Sinal Alto", detail: "3 canais" },
];

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M20.52 3.48A11.84 11.84 0 0 0 12.08 0 11.98 11.98 0 0 0 1.66 17.91L0 24l6.24-1.64A12 12 0 1 0 20.52 3.48Zm-8.44 17.2a9.97 9.97 0 0 1-5.08-1.39l-.36-.21-3.7.97.99-3.6-.23-.37a10 10 0 1 1 8.38 4.6Zm5.48-7.49c-.3-.15-1.79-.88-2.07-.98-.28-.1-.48-.15-.69.15-.2.3-.79.98-.97 1.18-.18.2-.36.22-.66.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.74-1.64-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.69-1.66-.95-2.28-.25-.6-.5-.52-.69-.53h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.52s1.08 2.92 1.23 3.12c.15.2 2.12 3.24 5.14 4.54.72.31 1.28.49 1.71.63.72.23 1.37.2 1.89.12.58-.09 1.79-.73 2.04-1.43.25-.7.25-1.3.18-1.43-.08-.12-.28-.2-.58-.35Z" />
    </svg>
  );
}

function ChannelToggle({ active, icon, title, onClick }: { active: boolean; icon: React.ReactNode; title: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`group flex min-h-[74px] items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-[.99] ${active ? "border-primary/35 bg-primary/7 shadow-sm ring-1 ring-primary/10" : "border-border/60 bg-background hover:border-primary/25 hover:bg-muted/40"}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-foreground"}`}>{icon}</span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-foreground">{title}</span></span>{active && <Check className="h-4 w-4 shrink-0 text-primary" />}</button>;
}

function FilterToggle({ checked, onChange, title, description }: { checked: boolean; onChange: (value: boolean) => void; title: string; description: string }) {
  return <label className={`group flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-all ${checked ? "border-primary/35 bg-primary/5 shadow-sm" : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20"}`}><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>{checked && <Check className="h-3 w-3" />}</span><input aria-label={title} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" /><span className="min-w-0"><span className="block text-xs font-semibold text-foreground">{title}</span><span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{description}</span></span></label>;
}

function HiddenFilterGroup({ title, summary, open, onToggle, children }: { title: string; summary: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <section className={`overflow-hidden rounded-xl border transition-all ${open ? "border-primary/25 bg-background" : "border-border/70 bg-muted/10"}`}><button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/30"><span className="min-w-0"><span className="block text-xs font-semibold text-foreground">{title}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{summary}</span></span>{open ? <ChevronDown className="h-4 w-4 shrink-0 text-primary" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}</button>{open && <div className="space-y-2 border-t border-border/60 bg-muted/10 p-3">{children}</div>}</section>;
}

export function FiltersMenu({ ratingFilters, onRatingFiltersChange, priceFilter, onPriceFilterChange, signalFilters, onSignalFiltersChange, contactFilters, onContactFiltersChange, noWebsiteOnly, onNoWebsiteOnlyChange, sortKey, onSortKeyChange }: FiltersMenuProps) {
  const [searchGroupOpen, setSearchGroupOpen] = useState(false);
  const [signalGroupOpen, setSignalGroupOpen] = useState(false);
  const [ratingGroupOpen, setRatingGroupOpen] = useState(false);
  const [priceGroupOpen, setPriceGroupOpen] = useState(false);
  const [sortGroupOpen, setSortGroupOpen] = useState(false);

  const activeCount = ratingFilters.length + Number(priceFilter !== "any") + signalFilters.length + contactFilters.length + Number(noWebsiteOnly);
  const ratingSummary = ratingFilters.length === 0 ? "Qualquer classificação" : ratingFilters.map((value) => RATING_OPTIONS.find((option) => option.value === value)?.label ?? value).join(", ");
  const presenceParts = [...contactFilters.map((value) => value === "whatsapp" ? "WhatsApp" : "Instagram"), ...(noWebsiteOnly ? ["Sem site"] : [])];
  const searchSummary = presenceParts.length === 0 ? "Sem restrições de presença" : presenceParts.join(" + ");
  const signalSummary = signalFilters.length === 0 ? "Todos os sinais" : signalFilters.length <= 2 ? signalFilters.map((value) => SIGNAL_OPTIONS.find((option) => option.value === value)?.label ?? value).join(" + ") : `${signalFilters.length} sinais selecionados`;
  const priceSummary = PRICE_OPTIONS.find((option) => option.value === priceFilter)?.label ?? "Qualquer preço";
  const sortSummary = SORT_LABELS[sortKey] ?? SORT_LABELS.relevance;
  const toggleContact = (value: ContactFilter) => onContactFiltersChange(contactFilters.includes(value) ? contactFilters.filter((item) => item !== value) : [...contactFilters, value]);
  const clearFilters = () => { onRatingFiltersChange([]); onPriceFilterChange("any"); onSignalFiltersChange([]); onContactFiltersChange([]); onNoWebsiteOnlyChange(false); onSortKeyChange("relevance"); };

  return <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="relative z-[1201] shrink-0 gap-1.5 border-border bg-background text-xs shadow-sm transition-all hover:border-primary/30 hover:bg-accent"><SlidersHorizontal className="h-3.5 w-3.5" /><span>Filtro de busca</span>{activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{activeCount}</span>}<ChevronDown className="h-3.5 w-3.5 opacity-70" /></Button></PopoverTrigger><PopoverContent align="end" sideOffset={8} collisionPadding={12} className="z-[5000] max-h-[min(82vh,700px)] w-[min(94vw,390px)] overflow-y-auto border-border bg-card p-3 shadow-2xl sm:p-4"><div className="sticky top-0 z-10 mb-3 flex items-start justify-between gap-3 border-b border-border bg-card pb-3"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><SlidersHorizontal className="h-3.5 w-3.5" /></div><div><h3 className="text-sm font-semibold text-foreground">Filtro de busca</h3><p className="mt-0.5 text-[10px] text-muted-foreground">Combine vários critérios para encontrar leads mais certeiros.</p></div></div>{activeCount > 0 && <button type="button" onClick={clearFilters} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"><X className="h-3 w-3" />Limpar</button>}</div><div className="space-y-2.5"><HiddenFilterGroup title="Sinais" summary={signalSummary} open={signalGroupOpen} onToggle={() => setSignalGroupOpen((open) => !open)}><div className="grid grid-cols-2 gap-2">{SIGNAL_OPTIONS.map((option) => { const active = signalFilters.includes(option.value); return <button key={option.value} type="button" onClick={() => onSignalFiltersChange(active ? signalFilters.filter((item) => item !== option.value) : [...signalFilters, option.value])} aria-pressed={active} className={`group flex min-h-[68px] flex-col items-start rounded-xl border p-3 text-left transition-all active:scale-[.99] ${active ? "border-primary/35 bg-primary/7 shadow-sm ring-1 ring-primary/10" : "border-border/60 bg-background hover:border-primary/25 hover:bg-muted/40"}`}><span className="flex w-full items-center justify-between gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-foreground"}`}><CircleDot className="h-3.5 w-3.5" /></span>{active && <Check className="h-4 w-4 text-primary" />}</span><span className="mt-1.5 text-[11px] font-semibold text-foreground">{option.label}</span><span className="mt-0.5 text-[9px] text-muted-foreground">{option.detail}</span></button>; })}</div>{signalFilters.length > 0 && <button type="button" onClick={() => onSignalFiltersChange([])} className="text-[10px] font-medium text-primary hover:underline">Limpar sinais</button>}</HiddenFilterGroup><HiddenFilterGroup title="Busca e presença" summary={searchSummary} open={searchGroupOpen} onToggle={() => setSearchGroupOpen((open) => !open)}><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><ChannelToggle active={contactFilters.includes("whatsapp")} icon={<WhatsAppIcon />} title="WhatsApp" onClick={() => toggleContact("whatsapp")} /><ChannelToggle active={contactFilters.includes("instagram")} icon={<Instagram className="h-4 w-4" />} title="Instagram" onClick={() => toggleContact("instagram")} /></div><FilterToggle checked={noWebsiteOnly} onChange={onNoWebsiteOnlyChange} title="Não possui site" description="Mantém negócios sem site próprio confirmado pela verificação web." /></HiddenFilterGroup><HiddenFilterGroup title="Classificação" summary={ratingSummary} open={ratingGroupOpen} onToggle={() => setRatingGroupOpen((open) => !open)}><div className="grid grid-cols-2 gap-2">{RATING_OPTIONS.map((option) => { const active = ratingFilters.includes(option.value); return <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2.5 text-xs transition-colors ${active ? "border-primary/30 bg-primary/5" : "border-border/60 bg-background hover:bg-muted/40"}`}><input type="checkbox" checked={active} onChange={() => onRatingFiltersChange(active ? ratingFilters.filter((item) => item !== option.value) : [...ratingFilters, option.value])} className="h-4 w-4 cursor-pointer accent-primary" /><span>{option.label}</span>{active && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</label>; })}</div>{ratingFilters.length > 0 && <button type="button" onClick={() => onRatingFiltersChange([])} className="text-[10px] font-medium text-primary hover:underline">Limpar classificação</button>}</HiddenFilterGroup><HiddenFilterGroup title="Preço" summary={priceSummary} open={priceGroupOpen} onToggle={() => setPriceGroupOpen((open) => !open)}><SelectOptionList value={priceFilter} onChange={onPriceFilterChange} options={PRICE_OPTIONS} groupName="price" /></HiddenFilterGroup><HiddenFilterGroup title="Ordenar" summary={sortSummary} open={sortGroupOpen} onToggle={() => setSortGroupOpen((open) => !open)}><div className="space-y-1.5">{Object.entries(SORT_LABELS).map(([value, label]) => { const active = sortKey === value; return <label key={value} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs transition-colors ${active ? "border-primary/30 bg-primary/5" : "border-border/60 bg-background hover:bg-muted/40"}`}><input type="radio" name="filter-sort" value={value} checked={active} onChange={() => onSortKeyChange(value as SortKey)} className="h-4 w-4 cursor-pointer accent-primary" /><span className="flex-1">{label}</span>{active && <Check className="h-3.5 w-3.5 text-primary" />}</label>; })}</div></HiddenFilterGroup></div></PopoverContent></Popover>;
}

function SelectOptionList<T extends string>({ value, onChange, options, groupName }: { value: T; onChange: (value: T) => void; options: Array<{ value: T; label: string }>; groupName: string }) {
  return <div className="space-y-1.5">{options.map((option) => { const active = value === option.value; return <label key={option.value} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs transition-colors ${active ? "border-primary/30 bg-primary/5 text-foreground" : "border-border/60 bg-background hover:bg-muted/40"}`}><input type="radio" name={`filter-${groupName}`} checked={active} onChange={() => onChange(option.value)} className="h-4 w-4 cursor-pointer accent-primary" /><span className="flex-1">{option.label}</span>{active && <Check className="h-3.5 w-3.5 text-primary" />}</label>; })}</div>;
}
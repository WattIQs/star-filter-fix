import { Check, LayoutGrid, ChevronDown, Radar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type CategoryKey } from "@/lib/types";

interface CategoryMenuProps { value: CategoryKey[]; onChange: (value: CategoryKey[]) => void; onScan: () => void; scanning: boolean; }
const ALL_KEYS = Object.keys(CATEGORY_LABELS) as CategoryKey[];

export function CategoryMenu({ value, onChange, onScan, scanning }: CategoryMenuProps) {
  const toggle = (key: CategoryKey) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return <Popover>
    <PopoverTrigger asChild><Button variant="outline" size="sm" className="relative z-[3001] shrink-0 gap-1.5 border-border bg-background text-xs shadow-sm hover:bg-accent"><LayoutGrid className="h-3.5 w-3.5" /><span className="hidden sm:inline">Categorias</span>{value.length > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">{value.length}</span>}<ChevronDown className="h-3.5 w-3.5 opacity-70" /></Button></PopoverTrigger>
    <PopoverContent align="start" sideOffset={8} collisionPadding={12} className="z-[5000] w-64 border-border bg-card p-2 shadow-2xl">
      <div className="mb-2 flex items-center justify-between px-1"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Categorias</span><button type="button" onClick={() => onChange(value.length === ALL_KEYS.length ? [] : ALL_KEYS)} className="text-[11px] text-primary hover:underline">{value.length === ALL_KEYS.length ? "Limpar" : "Todas"}</button></div>
      <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">{ALL_KEYS.map((key) => { const active = value.includes(key); return <button key={key} type="button" onClick={() => toggle(key)} className={cn("flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>{CATEGORY_LABELS[key]}{active && <Check className="h-3.5 w-3.5" />}</button>; })}</div>
      <div className="mt-2 border-t border-border pt-2"><Button type="button" onClick={onScan} disabled={scanning || value.length === 0} className="h-9 w-full gap-2 text-xs">{scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}{scanning ? "Varrendo..." : "Varrer área"}</Button><p className="mt-1.5 text-center text-[9px] text-muted-foreground">A busca mostra somente sinais zero.</p></div>
    </PopoverContent>
  </Popover>;
}

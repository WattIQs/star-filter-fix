import { Check, LayoutGrid, ChevronDown, Radar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type CategoryKey } from "@/lib/types";

interface CategoryMenuProps { value: CategoryKey[]; onChange: (value: CategoryKey[]) => void; onScan: () => void; scanning: boolean; }
const ALL_KEYS = Object.keys(CATEGORY_LABELS) as CategoryKey[];

export function CategoryMenu({ value, onChange, onScan, scanning }: CategoryMenuProps) {
  const toggle = (key: CategoryKey) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return <div className="flex shrink-0 items-center gap-1.5">
    <Popover>
      <PopoverTrigger asChild><Button variant="outline" size="sm" className="relative z-[3001] shrink-0 gap-1.5 border-border bg-background text-xs shadow-sm hover:bg-accent"><LayoutGrid className="h-3.5 w-3.5" /><span className="hidden sm:inline">Categorias</span>{value.length > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">{value.length}</span>}<ChevronDown className="h-3.5 w-3.5 opacity-70" /></Button></PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} collisionPadding={12} className="z-[5000] w-64 border-border bg-card p-2 shadow-2xl">
        <div className="mb-2 flex items-center justify-between px-1"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Categorias</span><button type="button" onClick={() => onChange(value.length === ALL_KEYS.length ? [] : ALL_KEYS)} className="text-[11px] text-primary hover:underline">{value.length === ALL_KEYS.length ? "Limpar" : "Todas"}</button></div>
        <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">{ALL_KEYS.map((key) => { const active = value.includes(key); return <button key={key} type="button" onClick={() => toggle(key)} className={cn("flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>{CATEGORY_LABELS[key]}{active && <Check className="h-3.5 w-3.5" />}</button>; })}</div>
        <p className="mt-2 border-t border-border pt-2 text-center text-[9px] text-muted-foreground">Selecione uma ou mais categorias para a varredura.</p>
      </PopoverContent>
    </Popover>

    <Button
      type="button"
      onClick={onScan}
      disabled={scanning || value.length === 0}
      aria-label={scanning ? "Varrendo área" : "Varrer área"}
      className={cn(
        "group relative h-9 shrink-0 gap-2 overflow-visible rounded-lg border border-primary/30 px-3 text-xs font-semibold shadow-md transition-all duration-200",
        "bg-primary text-primary-foreground hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-lg active:translate-y-0",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-md",
      )}
    >
      {scanning && <span className="pointer-events-none absolute -inset-1 rounded-xl border border-primary/40 animate-ping opacity-30" aria-hidden="true" />}
      <span className="relative flex items-center gap-2">
        {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-45" />}
        <span>{scanning ? "Varrendo..." : "Varrer área"}</span>
      </span>
    </Button>
  </div>;
}

import { Check, LayoutGrid, ChevronDown, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type CategoryKey } from "@/lib/types";

interface CategoryMenuProps {
  value: CategoryKey[];
  onChange: (value: CategoryKey[]) => void;
  onScan?: () => void;
  scanning?: boolean;
}
const ALL_KEYS = Object.keys(CATEGORY_LABELS) as CategoryKey[];

export function CategoryMenu({ value, onChange, onScan, scanning = false }: CategoryMenuProps) {
  const toggle = (key: CategoryKey) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        type="button"
        onClick={onScan}
        disabled={scanning || !onScan}
        aria-label="Varrer área"
        className={cn(
          "group relative h-9 shrink-0 gap-2 overflow-hidden rounded-lg border border-primary/30 px-3 text-xs font-semibold shadow-md transition-colors duration-200",
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_8px_24px_-16px_var(--color-primary)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <span className="relative flex items-center gap-2">
          <Radar className="h-3.5 w-3.5" />
          <span>Varrer área</span>
        </span>
      </Button>
      <Popover>
        <PopoverTrigger asChild><Button variant="outline" size="sm" className={cn("relative z-[3001] shrink-0 gap-1.5 border-border bg-background text-xs shadow-sm transition-all duration-200 hover:translate-y-0 hover:border-primary/30 hover:bg-accent", value.length > 0 && "border-primary/35 bg-primary/5")}><LayoutGrid className="h-3.5 w-3.5" /><span className="hidden sm:inline">Categorias</span>{value.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{value.length}</span>}<ChevronDown className="h-3.5 w-3.5 opacity-70" /></Button></PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} collisionPadding={12} className="z-[5000] w-[min(92vw,300px)] border-border bg-card/98 p-2.5 shadow-2xl backdrop-blur-xl">
          <div className="mb-2.5 flex items-center justify-between gap-2 px-1"><div><span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Categorias</span><span className="text-[10px] text-muted-foreground">Escolha uma ou mais áreas</span></div><button type="button" onClick={() => onChange(value.length === ALL_KEYS.length ? [] : ALL_KEYS)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/10">{value.length === ALL_KEYS.length ? "Limpar" : "Todas"}</button></div>
          <div className="grid max-h-80 grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">{ALL_KEYS.map((key) => { const active = value.includes(key); return <button key={key} type="button" onClick={() => toggle(key)} className={cn("flex min-h-9 items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium transition-all duration-150", active ? "border-primary/25 bg-primary/10 text-primary shadow-sm" : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground")}>{CATEGORY_LABELS[key]}{active && <Check className="h-3.5 w-3.5 shrink-0" />}</button>; })}</div>
          <p className="mt-2 border-t border-border/60 pt-2 text-center text-[9px] leading-relaxed text-muted-foreground">Sem seleção = buscar todas as categorias disponíveis.</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

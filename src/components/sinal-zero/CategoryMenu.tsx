import { Check, LayoutGrid, ChevronDown, Radar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type CategoryKey } from "@/lib/types";

interface CategoryMenuProps {
  value: CategoryKey[];
  onChange: (value: CategoryKey[]) => void;
  onScan: () => void;
  scanning: boolean;
}

const ALL_KEYS = Object.keys(CATEGORY_LABELS) as CategoryKey[];

export function CategoryMenu({ value, onChange, onScan, scanning }: CategoryMenuProps) {
  const toggle = (key: CategoryKey) => {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative z-[1201] shrink-0 gap-1.5 border-border bg-background text-xs shadow-sm hover:bg-accent"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>Categorias</span>
          {value.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {value.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="z-[5000] w-[300px] border-border bg-card p-3 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Categorias</h3>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Escolha o que será procurado</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(value.length === ALL_KEYS.length ? [] : ALL_KEYS)}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            {value.length === ALL_KEYS.length ? "Limpar" : "Todas"}
          </button>
        </div>
        <div className="max-h-[min(380px,55vh)] space-y-0.5 overflow-y-auto pr-1">
          {ALL_KEYS.map((key) => {
            const active = value.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className={cn(
                  "flex min-h-9 w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors",
                  active ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-muted",
                )}
              >
                <span>{CATEGORY_LABELS[key]}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={scanning || value.length === 0}
          onClick={onScan}
          className="mt-3 w-full gap-2"
        >
          <Radar className={cn("h-3.5 w-3.5", scanning && "animate-spin")} />
          {scanning ? "Varrendo..." : "Varrer área agora"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

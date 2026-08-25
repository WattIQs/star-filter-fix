import { Check, LayoutGrid, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type CategoryKey } from "@/lib/types";

interface CategoryMenuProps {
  value: CategoryKey[];
  onChange: (value: CategoryKey[]) => void;
}

const ALL_KEYS = Object.keys(CATEGORY_LABELS) as CategoryKey[];

export function CategoryMenu({ value, onChange }: CategoryMenuProps) {
  const toggle = (key: CategoryKey) => {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs">
          <LayoutGrid className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Categorias</span>
          {value.length > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
              {value.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Categorias
          </span>
          <button
            type="button"
            onClick={() => onChange(value.length === ALL_KEYS.length ? [] : ALL_KEYS)}
            className="text-[11px] text-primary hover:underline"
          >
            {value.length === ALL_KEYS.length ? "Limpar" : "Todas"}
          </button>
        </div>
        <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
          {ALL_KEYS.map((key) => {
            const active = value.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {CATEGORY_LABELS[key]}
                {active && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

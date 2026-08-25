import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { SavedLead } from "@/lib/types";
import { SignalBadge } from "./SignalBadge";
import { ExportCsvButton } from "./ExportCsvButton";

interface SavedLeadsDrawerProps {
  leads: SavedLead[];
  onRemove: (id: string) => void;
}

export function SavedLeadsDrawer({ leads, onRemove }: SavedLeadsDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-xs">
          Leads salvos
          <Badge
            variant="secondary"
            className="ml-1 h-4 min-w-4 px-1 text-[10px]"
          >
            {leads.length}
          </Badge>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col border-border bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-foreground">Leads salvos</SheetTitle>
        </SheetHeader>

        {leads.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <p>Nenhum lead salvo ainda.</p>
            <p className="mt-1 text-xs">
              Escaneie uma área e clique em "Salvar lead" para começar.
            </p>
          </div>
        ) : (
          <>
            <div className="py-2">
              <ExportCsvButton />
            </div>
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-3 pb-4">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-medium text-foreground">
                          {lead.name}
                        </h4>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {lead.category}
                        </p>
                      </div>
                      <SignalBadge level={lead.level} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {lead.address || "Sem endereço"}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground/60">
                        {new Date(lead.savedAt).toLocaleDateString("pt-BR")}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove(lead.id)}
                        aria-label="Remover lead"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

import {
  Bookmark,
  BookmarkCheck,
  Clock,
  Globe,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Establishment } from "@/lib/types";
import { SignalBadge } from "./SignalBadge";

interface PlaceRowProps {
  place: Establishment;
  active: boolean;
  saved: boolean;
  onSelect: (id: string) => void;
  onToggleSave: (place: Establishment) => void;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className="font-semibold text-signal-weak">{rating.toFixed(1)}</span>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn("h-3 w-3", i <= Math.round(rating) ? "fill-signal-weak text-signal-weak" : "text-muted-foreground/40")}
          />
        ))}
      </span>
    </span>
  );
}

export function PlaceRow({ place, active, saved, onSelect, onToggleSave }: PlaceRowProps) {
  const { contact, details } = place;

  return (
    <article
      onClick={() => onSelect(place.id)}
      className={cn(
        "group cursor-pointer border-b border-border/60 px-4 py-3 opacity-0 [animation:lead-enter_360ms_ease-out_forwards] transition-all duration-200",
        "hover:-translate-y-px hover:bg-accent/40 hover:shadow-[inset_3px_0_0_hsl(var(--primary))]",
        active && "translate-x-0.5 bg-primary/10 shadow-[inset_3px_0_0_hsl(var(--primary))]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">{place.name}</h3>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {place.rating !== null ? <Stars rating={place.rating} /> : <span className="text-muted-foreground/60">Sem nota pública</span>}
            <span>·</span>
            <span>{place.category}</span>
            {place.priceLevel && <><span>·</span><span className="text-signal-full">{"$".repeat(place.priceLevel)}</span></>}
          </div>

          {place.address && <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="line-clamp-1">{place.address}</span></p>}
          {details.openingHours && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3 shrink-0" /><span className="line-clamp-1">{details.openingHours}</span></p>}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {contact.whatsappUrl && contact.whatsappValid && (
              <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 rounded-full border border-signal-zero/40 bg-signal-zero/10 px-2.5 py-1 text-[11px] font-medium text-signal-zero transition-transform hover:scale-[1.03] hover:bg-signal-zero/20">
                <MessageCircle className="h-3 w-3" />WhatsApp
              </a>
            )}
            {contact.instagramUrl && <a href={contact.instagramUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 rounded-full border border-cyan/40 bg-cyan/10 px-2.5 py-1 text-[11px] font-medium text-cyan transition-transform hover:scale-[1.03] hover:bg-cyan/20"><Instagram className="h-3 w-3" />Instagram</a>}
            {contact.websiteUrl && <a href={contact.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-transform hover:scale-[1.03] hover:bg-accent"><Globe className="h-3 w-3" />Site</a>}
            {contact.email && <a href={`mailto:${contact.email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-transform hover:scale-[1.03] hover:bg-accent"><Mail className="h-3 w-3" />E-mail</a>}
            <a href={place.directionsUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-transform hover:scale-[1.03] hover:bg-accent"><Navigation className="h-3 w-3" />Rotas</a>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <SignalBadge signalCount={place.signalCount} />
          <button type="button" aria-label={saved ? "Remover dos salvos" : "Salvar lead"} onClick={(e) => { e.stopPropagation(); onToggleSave(place); }} className="rounded-full border border-border p-1.5 text-muted-foreground transition-all hover:scale-105 hover:bg-accent hover:text-foreground">
            {saved ? <BookmarkCheck className="h-3.5 w-3.5 text-primary" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </article>
  );
}

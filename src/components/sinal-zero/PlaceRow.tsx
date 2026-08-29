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
import type { CSSProperties } from "react";
import type { Establishment } from "@/lib/types";
import { SignalBadge } from "./SignalBadge";

interface PlaceRowProps {
  place: Establishment;
  active: boolean;
  saved: boolean;
  onSelect: (id: string) => void;
  onToggleSave: (place: Establishment) => void;
  animationDelay?: number;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1 text-[11px] tabular-nums">
      <span className="font-bold text-signal-weak">{rating.toFixed(1)}</span>
      <span className="flex gap-px">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn("h-3 w-3", i <= Math.round(rating) ? "fill-signal-weak text-signal-weak" : "text-muted-foreground/25")} />
        ))}
      </span>
    </span>
  );
}

export function PlaceRow({ place, active, saved, onSelect, onToggleSave, animationDelay = 0 }: PlaceRowProps) {
  const { contact, details } = place;
  const animationStyle = { "--lead-delay": `${animationDelay}ms` } as CSSProperties;
  return (
    <article
      onClick={() => onSelect(place.id)}
      style={animationStyle}
      className={cn(
        "group relative cursor-pointer rounded-xl border border-border/60 bg-card/80 px-3.5 py-3 opacity-0 [animation:lead-enter_560ms_cubic-bezier(.22,1,.36,1)_var(--lead-delay)_both] transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-[0_14px_34px_-24px_var(--color-primary)]",
        active && "border-primary/35 bg-primary/7 shadow-[0_14px_34px_-20px_var(--color-primary)] ring-1 ring-primary/10",
      )}
    >
      <span className={cn("absolute inset-y-3 left-0 w-0.5 rounded-full bg-transparent transition-all", (active || place.signalCount === 0) && "bg-primary", active && "w-1")} aria-hidden="true" />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13px] font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">{place.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
            {place.rating !== null ? <Stars rating={place.rating} /> : <span className="text-[10px] text-muted-foreground/55">Sem nota pública</span>}
            <span className="text-muted-foreground/30">•</span>
            <span className="rounded-full bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{place.category}</span>
            {place.priceLevel && <span className="text-[10px] font-semibold tracking-wide text-signal-full">{"$".repeat(place.priceLevel)}</span>}
          </div>
          {place.address && <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/60" /><span className="line-clamp-1">{place.address}</span></p>}
          {details.openingHours && <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground/80"><Clock className="h-3 w-3 shrink-0 text-muted-foreground/55" /><span className="line-clamp-1">{details.openingHours}</span></p>}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {contact.whatsappUrl && contact.whatsappValid && <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-full border border-signal-zero/35 bg-signal-zero/10 px-2 py-1 text-[10px] font-semibold text-signal-zero transition-all hover:-translate-y-px hover:bg-signal-zero/15"><MessageCircle className="h-3 w-3" />WhatsApp</a>}
            {contact.instagramUrl && <a href={contact.instagramUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-full border border-cyan/30 bg-cyan/8 px-2 py-1 text-[10px] font-semibold text-cyan transition-all hover:-translate-y-px hover:bg-cyan/15"><Instagram className="h-3 w-3" />Instagram</a>}
            {contact.websiteUrl && <a href={contact.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-all hover:-translate-y-px hover:bg-accent hover:text-foreground"><Globe className="h-3 w-3" />Site</a>}
            {contact.email && <a href={`mailto:${contact.email}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-all hover:-translate-y-px hover:bg-accent hover:text-foreground"><Mail className="h-3 w-3" />E-mail</a>}
            <a href={place.directionsUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-all hover:-translate-y-px hover:bg-accent hover:text-foreground"><Navigation className="h-3 w-3" />Rotas</a>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <SignalBadge signalCount={place.signalCount} />
          <button type="button" aria-label={saved ? "Remover dos salvos" : "Salvar lead"} onClick={(e) => { e.stopPropagation(); onToggleSave(place); }} className={cn("rounded-lg border p-1.5 transition-all hover:-translate-y-px hover:bg-accent", saved ? "border-primary/25 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </article>
  );
}

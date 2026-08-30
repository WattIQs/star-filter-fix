import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVEL_CONFIG = {
  zero: { label: "Sinal Zero", bars: 0, className: "bg-signal-zero/15 text-signal-zero border-signal-zero/40 animate-glow-pulse" },
  weak: { label: "Sinal Fraco", bars: 1, className: "bg-signal-weak/15 text-signal-weak border-signal-weak/40" },
  medium: { label: "Sinal Médio", bars: 2, className: "bg-signal-weak/15 text-signal-weak border-signal-weak/40" },
  high: { label: "Sinal Alto", bars: 3, className: "bg-cyan/15 text-cyan border-cyan/40" },
} as const;
type SignalBadgeLevel = keyof typeof LEVEL_CONFIG;

function readReviewCount(tags: Record<string, string>): number | null {
  const raw = tags["review_count"] ?? tags["reviews"] ?? tags["rating:count"] ?? tags["rating_count"];
  if (!raw) return null;
  const value = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function SignalBadge({ signalCount, rating, tags }: { signalCount: number; rating?: number | null; tags?: Record<string, string> }) {
  const level: SignalBadgeLevel = signalCount <= 0 ? "zero" : signalCount === 1 ? "weak" : signalCount === 2 ? "medium" : "high";
  const config = LEVEL_CONFIG[level];
  const reviewCount = tags ? readReviewCount(tags) : null;
  const sentiment = rating === null || rating === undefined ? null : rating >= 4 ? "positivo" : rating <= 2.5 ? "negativo" : "misto";
  return (
    <div className={cn("inline-flex max-w-[190px] flex-col gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold tracking-wide", config.className)} title="Sinal combina presença digital e reputação pública quando disponível">
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 gap-0.5" aria-hidden="true">{[1, 2, 3].map((i) => <span key={i} className={cn("h-2.5 w-1 rounded-sm", i <= config.bars ? level === "high" ? "bg-cyan" : "bg-signal-weak" : "bg-muted-foreground/25")} />)}</span>
        <span>{config.label}</span>
      </div>
      {(rating !== null && rating !== undefined || reviewCount !== null) && <div className="flex items-center gap-1.5 text-[10px] font-medium normal-case tracking-normal opacity-90">
        {rating !== null && rating !== undefined && <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-current" />{rating.toFixed(1)}</span>}
        {reviewCount !== null && <span>{reviewCount.toLocaleString("pt-BR")} avaliações</span>}
        {sentiment && <span className="opacity-75">· {sentiment}</span>}
      </div>}
    </div>
  );
}

import { cn } from "@/lib/utils";

const LEVEL_CONFIG = {
  zero: { label: "Sinal Zero", bars: 0, className: "bg-signal-zero/15 text-signal-zero border-signal-zero/40 animate-glow-pulse" },
  weak: { label: "Sinal Fraco", bars: 1, className: "bg-signal-weak/15 text-signal-weak border-signal-weak/40" },
  medium: { label: "Sinal Médio", bars: 2, className: "bg-signal-weak/15 text-signal-weak border-signal-weak/40" },
  high: { label: "Sinal Alto", bars: 3, className: "bg-cyan/15 text-cyan border-cyan/40" },
} as const;

type SignalBadgeLevel = keyof typeof LEVEL_CONFIG;

export function SignalBadge({ signalCount }: { signalCount: number }) {
  const level: SignalBadgeLevel = signalCount <= 0 ? "zero" : signalCount === 1 ? "weak" : signalCount === 2 ? "medium" : "high";
  const config = LEVEL_CONFIG[level];

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide", config.className)}>
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-2.5 w-1 rounded-sm", i <= config.bars ? level === "high" ? "bg-cyan" : "bg-signal-weak" : "bg-muted-foreground/25")} />
        ))}
      </span>
      {config.label}
    </div>
  );
}

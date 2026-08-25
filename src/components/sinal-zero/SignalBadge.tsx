import { cn } from "@/lib/utils";
import type { SignalLevel } from "@/lib/types";

const LEVEL_CONFIG: Record<
  SignalLevel,
  { label: string; bars: number; className: string }
> = {
  zero: {
    label: "Sinal Zero",
    bars: 0,
    className:
      "bg-signal-zero/15 text-signal-zero border-signal-zero/40 animate-glow-pulse",
  },
  weak: {
    label: "Sinal Fraco",
    bars: 1,
    className: "bg-signal-weak/15 text-signal-weak border-signal-weak/40",
  },
  full: {
    label: "Sinal Pleno",
    bars: 3,
    className: "bg-cyan/15 text-cyan border-cyan/40",
  },
};

export function SignalBadge({ level }: { level: SignalLevel }) {
  const config = LEVEL_CONFIG[level];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide",
        config.className
      )}
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-2.5 w-1 rounded-sm",
              i <= config.bars
                ? level === "full"
                  ? "bg-cyan"
                  : "bg-signal-weak"
                : "bg-muted-foreground/25"
            )}
          />
        ))}
      </span>
      {config.label}
    </div>
  );
}

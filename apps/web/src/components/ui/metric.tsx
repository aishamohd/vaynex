import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { TONE_HEX, type Tone } from "@/lib/utils/status";

export function Metric({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
  className,
  emphasize,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
  emphasize?: boolean;
}) {
  const color = tone === "neutral" ? undefined : TONE_HEX[tone];
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col justify-between gap-1 border border-line bg-panel/80 px-3 py-2.5",
        emphasize && tone === "crit" && "border-red/50 shadow-glow-red",
        emphasize && tone === "warn" && "border-amber/50",
        className,
      )}
    >
      <span className="absolute left-0 top-0 h-full w-[2px]" style={{ background: color ?? "#1B2A38" }} />
      <div className="flex items-center justify-between gap-2">
        <span className="label truncate">{label}</span>
        {icon && <span className="text-dim">{icon}</span>}
      </div>
      <div className="num text-2xl font-semibold leading-none" style={{ color: color ?? "#EAF2F7" }}>
        {value}
      </div>
      {sub && <div className="truncate font-mono text-2xs text-dim">{sub}</div>}
    </div>
  );
}

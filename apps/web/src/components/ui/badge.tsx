import { cn } from "@/lib/utils/cn";
import { humanize } from "@/lib/utils/format";
import { levelTone, statusTone, type Tone } from "@/lib/utils/status";

const TONE_CLASS: Record<Tone, string> = {
  ok: "text-green border-green/40 bg-green-soft/40",
  warn: "text-amber border-amber/40 bg-amber-soft/40",
  crit: "text-red border-red/50 bg-red-soft/50",
  info: "text-blue border-blue/40 bg-blue-soft/50",
  neutral: "text-muted border-line bg-elevated",
  accent: "text-cyan border-cyan/40 bg-cyan-soft/40",
};

const DOT_CLASS: Record<Tone, string> = {
  ok: "bg-green",
  warn: "bg-amber",
  crit: "bg-red",
  info: "bg-blue",
  neutral: "bg-muted",
  accent: "bg-cyan",
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  pulse = false,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap border px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot && (
        <span className="relative inline-flex h-1.5 w-1.5">
          {pulse && <span className={cn("absolute inset-0 rounded-full animate-pulse-ring", DOT_CLASS[tone])} />}
          <span className={cn("relative h-1.5 w-1.5 rounded-full", DOT_CLASS[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const tone = statusTone(status);
  return (
    <Badge tone={tone} dot pulse={tone === "crit"} className={className}>
      {humanize(status)}
    </Badge>
  );
}

export function LevelBadge({ level, className }: { level: string | null | undefined; className?: string }) {
  return (
    <Badge tone={levelTone(level)} className={className}>
      {humanize(level)}
    </Badge>
  );
}

export function Dot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {pulse && <span className={cn("absolute inset-0 rounded-full animate-pulse-ring", DOT_CLASS[tone])} />}
      <span className={cn("relative h-2 w-2 rounded-full", DOT_CLASS[tone])} />
    </span>
  );
}

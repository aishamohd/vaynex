import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface PanelProps {
  title?: ReactNode;
  code?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: "default" | "crit" | "warn" | "accent";
}

export function Panel({ title, code, actions, children, className, bodyClassName, tone = "default" }: PanelProps) {
  return (
    <section
      className={cn(
        "relative flex min-h-0 flex-col border bg-panel/90",
        tone === "default" && "border-line",
        tone === "crit" && "border-red/50 shadow-glow-red",
        tone === "warn" && "border-amber/50",
        tone === "accent" && "border-cyan/40 shadow-glow",
        className,
      )}
    >
      {/* corner ticks */}
      <span className="pointer-events-none absolute -left-px -top-px h-2 w-2 border-l border-t border-cyan/60" />
      <span className="pointer-events-none absolute -right-px -top-px h-2 w-2 border-r border-t border-cyan/60" />
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {code && <span className="font-mono text-2xs text-cyan/70">{code}</span>}
            {typeof title === "string" ? <h2 className="label truncate text-ink/80">{title}</h2> : title}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("min-h-0 flex-1", bodyClassName ?? "p-3")}>{children}</div>
    </section>
  );
}

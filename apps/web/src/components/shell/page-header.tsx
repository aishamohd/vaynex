import type { ReactNode } from "react";

export function PageHeader({
  code,
  title,
  subtitle,
  actions,
}: {
  code: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
      <div>
        <div className="font-mono text-2xs tracking-[0.3em] text-cyan/70">{code}</div>
        <h1 className="mt-1 font-mono text-lg font-semibold uppercase tracking-[0.22em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

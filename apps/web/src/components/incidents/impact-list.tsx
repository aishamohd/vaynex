import { ArrowRight, Boxes, Radio } from "lucide-react";
import { humanize } from "@/lib/utils/format";
import type { ImpactNode } from "@/types";
import { Badge, StatusBadge } from "@/components/ui/badge";

const REL_TONE = {
  ORIGIN: "crit",
  DIRECT_EXPOSURE: "warn",
  DEPENDENCY: "accent",
  HOSTED_SERVICE: "info",
} as const;

export function ImpactList({ nodes, empty = "None in the impact path." }: { nodes: ImpactNode[]; empty?: string }) {
  if (!nodes.length) return <p className="py-2 text-xs text-muted">{empty}</p>;
  const sorted = [...nodes].sort((a, b) => a.depth - b.depth || b.impact_weight - a.impact_weight);
  return (
    <ul className="divide-y divide-line/70">
      {sorted.map((n) => (
        <li key={`${n.kind}-${n.id}`} className="py-2">
          <div className="flex items-start gap-2">
            {n.kind === "INFRASTRUCTURE" ? (
              <Boxes className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan/70" />
            ) : (
              <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm text-ink">{n.name}</span>
                <Badge tone={REL_TONE[n.relationship as keyof typeof REL_TONE] ?? "neutral"}>{humanize(n.relationship)}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-2xs text-muted">
                <span>{humanize(n.type)}</span>
                <span>DEPTH {n.depth}</span>
                <span>IMPACT {(n.impact_weight * 100).toFixed(0)}%</span>
                {n.dependency_type && (
                  <span>
                    {n.dependency_type}/{n.dependency_strength}
                  </span>
                )}
                {typeof n.distance_m === "number" && <span>{Math.round(n.distance_m)} M</span>}
              </div>
              {n.path.length > 1 && (
                <div className="mt-1 flex flex-wrap items-center gap-1 font-mono text-2xs text-dim">
                  {n.path.map((p, i) => (
                    <span key={`${p}-${i}`} className="flex items-center gap-1">
                      {i > 0 && <ArrowRight className="h-2.5 w-2.5" />}
                      <span className={i === n.path.length - 1 ? "text-ink/70" : undefined}>{p}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge status={n.status} />
              {n.previous_status && n.previous_status !== n.status && (
                <span className="font-mono text-[9px] text-dim">WAS {n.previous_status}</span>
              )}
            </div>
          </div>
          <div className="mt-1.5 h-[2px] w-full bg-elevated">
            <div className="h-full bg-red/70" style={{ width: `${Math.round(n.impact_weight * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

import { BrainCircuit, ShieldCheck, Sparkles } from "lucide-react";
import type { AIAnalysis } from "@/types";
import { Badge, LevelBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

/**
 * Displays exactly what the backend returned. `reasoning` is the backend's short
 * evidence-basis string (graph + risk-model facts), shown as "EVIDENCE BASIS".
 */
export function AIAnalysisView({ analysis, compact = false }: { analysis: AIAnalysis; compact?: boolean }) {
  const confidence = Math.round(analysis.confidence * 100);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">
          <BrainCircuit className="h-3 w-3" /> {analysis.provider}
        </Badge>
        {analysis.model && <Badge tone="neutral">{analysis.model}</Badge>}
        {analysis.advisory_only && (
          <Badge tone="warn">
            <ShieldCheck className="h-3 w-3" /> ADVISORY ONLY
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="label">CONFIDENCE</span>
          <div className="h-1.5 w-24 bg-elevated">
            <div className="h-full bg-cyan" style={{ width: `${confidence}%` }} />
          </div>
          <span className="num text-sm text-cyan">{confidence}%</span>
        </div>
      </div>

      <div>
        <span className="label">AI SUMMARY</span>
        <p className="mt-1.5 text-sm leading-relaxed text-ink/90">{analysis.summary}</p>
      </div>

      <div className={cn("grid gap-4", !compact && "md:grid-cols-2")}>
        <div>
          <span className="label">POTENTIAL IMPACT</span>
          {analysis.potential_impact.length ? (
            <ul className="mt-1.5 space-y-1.5">
              {analysis.potential_impact.map((p, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed text-ink/80">
                  <span className="mt-1.5 h-1 w-1 shrink-0 bg-amber" />
                  {p}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted">None reported.</p>
          )}
        </div>
        <div>
          <span className="label">AFFECTED SERVICES</span>
          {analysis.affected_services.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {analysis.affected_services.map((s) => (
                <Badge key={s} tone="crit">
                  {s}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted">None reported.</p>
          )}
        </div>
      </div>

      <div>
        <span className="label">RECOMMENDED ACTIONS</span>
        {analysis.recommended_actions.length ? (
          <ol className="mt-1.5 space-y-1.5">
            {analysis.recommended_actions.map((a, i) => (
              <li key={i} className="flex gap-2 border border-line bg-bg/40 px-2.5 py-2">
                <span className="num text-2xs text-cyan">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-ink">{a.title}</span>
                    <LevelBadge level={a.priority} />
                  </div>
                  {a.description && <p className="mt-0.5 text-xs text-muted">{a.description}</p>}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-xs text-muted">None.</p>
        )}
      </div>

      {analysis.reasoning && (
        <div className="border-l-2 border-cyan/40 pl-2.5">
          <span className="label flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-cyan/70" /> EVIDENCE BASIS
          </span>
          <p className="mt-1 text-xs leading-relaxed text-muted">{analysis.reasoning}</p>
        </div>
      )}
    </div>
  );
}

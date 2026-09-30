"use client";

import { Bot, Check, CheckCheck, Cpu, ScrollText, UserCheck, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRole } from "@/hooks/use-session";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, shortId } from "@/lib/utils/format";
import type { Recommendation, RecommendationDecision } from "@/types";
import { Badge, LevelBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DecisionDialog } from "./decision-dialog";

export function RecommendationCard({
  rec,
  showIncident = false,
  dense = false,
}: {
  rec: Recommendation;
  showIncident?: boolean;
  dense?: boolean;
}) {
  const { canOperate } = useRole();
  const [decision, setDecision] = useState<RecommendationDecision | null>(null);
  const SourceIcon = rec.source === "AI" ? Bot : Cpu;

  return (
    <article
      className={cn(
        "border bg-panel/80 transition-colors",
        rec.status === "PENDING" && rec.priority === "CRITICAL" ? "border-red/40" : "border-line",
      )}
    >
      <div className={cn("flex gap-3", dense ? "p-2.5" : "p-3")}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <LevelBadge level={rec.priority} />
            <Badge tone={rec.source === "AI" ? "accent" : "neutral"}>
              <SourceIcon className="h-3 w-3" /> {rec.source === "AI" ? "AI" : "RULE ENGINE"}
            </Badge>
            <StatusBadge status={rec.status} />
            {showIncident && (
              <Link
                href={`/command/incidents/${rec.incident_id}`}
                className="font-mono text-2xs text-cyan/80 hover:text-cyan"
              >
                INC-{shortId(rec.incident_id)}
              </Link>
            )}
          </div>
          <h3 className="mt-1.5 text-sm font-medium text-ink">{rec.title}</h3>
          {!dense && <p className="mt-1 text-xs leading-relaxed text-muted">{rec.description}</p>}
          <DecisionTrail rec={rec} />
        </div>
        {canOperate && (rec.status === "PENDING" || rec.status === "ACCEPTED") && (
          <div className="flex shrink-0 flex-col gap-1.5">
            {rec.status === "PENDING" && (
              <>
                <Button size="sm" variant="success" onClick={() => setDecision("ACCEPTED")}>
                  <Check className="h-3 w-3" /> Accept
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDecision("REJECTED")}>
                  <X className="h-3 w-3" /> Reject
                </Button>
              </>
            )}
            {rec.status === "ACCEPTED" && (
              <Button size="sm" variant="primary" onClick={() => setDecision("COMPLETED")}>
                <CheckCheck className="h-3 w-3" /> Complete
              </Button>
            )}
          </div>
        )}
      </div>
      {decision && (
        <DecisionDialog rec={rec} decision={decision} open={!!decision} onOpenChange={(o) => !o && setDecision(null)} />
      )}
    </article>
  );
}

/** AI RECOMMENDATION → HUMAN REVIEW → DECISION → AUDIT */
function DecisionTrail({ rec }: { rec: Recommendation }) {
  const decided = rec.status !== "PENDING";
  const steps = [
    { label: rec.source === "AI" ? "AI RECOMMENDATION" : "RULE RECOMMENDATION", done: true, icon: rec.source === "AI" ? Bot : Cpu },
    { label: "HUMAN REVIEW", done: decided, active: !decided, icon: UserCheck },
    {
      label: decided ? rec.status : "ACCEPT / REJECT",
      done: decided,
      icon: rec.status === "REJECTED" ? X : Check,
      tone: rec.status === "REJECTED" ? "text-red" : "text-green",
    },
    { label: "AUDIT", done: decided, icon: ScrollText },
  ];
  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap items-center gap-1">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-1">
              {i > 0 && <span className={cn("h-px w-3", s.done ? "bg-cyan/60" : "bg-line")} />}
              <span
                className={cn(
                  "flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] tracking-wider",
                  s.done ? "border-cyan/30 text-ink/80" : "border-line text-dim",
                  s.active && "animate-blink border-amber/50 text-amber",
                )}
              >
                <Icon className={cn("h-2.5 w-2.5", s.done && s.tone)} />
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      {decided && (
        <p className="mt-1.5 font-mono text-2xs text-dim">
          DECIDED {formatDateTime(rec.decided_at)} · OPERATOR {shortId(rec.decided_by)}
          {rec.decision_note ? ` · “${rec.decision_note}”` : ""}
        </p>
      )}
    </div>
  );
}

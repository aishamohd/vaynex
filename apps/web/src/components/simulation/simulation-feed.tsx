"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BrainCircuit, ClipboardList, GitBranch, Gauge, MapPin, ScrollText, Siren, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useRecommendations } from "@/hooks/use-vaynex";
import { formatTime, humanize, shortId } from "@/lib/utils/format";
import type { SimulationRunResponse } from "@/types";
import { Badge, LevelBadge, StatusBadge } from "@/components/ui/badge";
import { RiskBlock } from "@/components/incidents/risk";
import { ImpactList } from "@/components/incidents/impact-list";
import { AIAnalysisView } from "@/components/intelligence/ai-analysis";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";

/** Cards revealed in timeline order. All content is taken from the simulation response. */
export function SimulationFeed({
  result,
  reached,
}: {
  result: SimulationRunResponse;
  reached: (step: string) => boolean;
}) {
  // Live status for the recommendations the simulation created (decisions update in place).
  const live = useRecommendations({ incident_id: result.incident?.id }, !!result.incident);
  const liveById = new Map((live.data?.items ?? []).map((r) => [r.id, r]));
  const t = (step: string) => result.timeline.find((x) => x.step === step);
  const origin = [...result.affected_infrastructure, ...result.affected_services].find((n) => n.relationship === "ORIGIN");

  return (
    <div className="divide-y divide-line">
      <AnimatePresence initial={false}>
        {reached("EVENT_CREATED") && (
          <FeedCard key="ev" icon={<Zap className="h-3.5 w-3.5" />} title="EVENT CREATED" at={t("EVENT_CREATED")?.at}>
            <div className="flex flex-wrap items-center gap-1.5">
              <LevelBadge level={result.event.severity} />
              <Badge tone="accent">{humanize(result.event.event_type)}</Badge>
              <span className="font-mono text-2xs text-muted">SRC {result.event.source}</span>
            </div>
            <p className="mt-1.5 text-sm text-ink">{result.event.title}</p>
            {result.event.description && <p className="mt-0.5 text-xs text-muted">{result.event.description}</p>}
          </FeedCard>
        )}
        {reached("INFRASTRUCTURE_CONTEXT") && (
          <FeedCard key="ctx" icon={<MapPin className="h-3.5 w-3.5" />} title="INFRASTRUCTURE CONTEXT" at={t("INFRASTRUCTURE_CONTEXT")?.at}>
            <p className="text-xs text-ink/85">{t("INFRASTRUCTURE_CONTEXT")?.detail}</p>
            {origin && (
              <div className="mt-1.5 flex items-center gap-2">
                <StatusBadge status={origin.status} />
                <span className="text-sm text-ink">{origin.name}</span>
                <span className="font-mono text-2xs text-dim">{humanize(origin.type)}</span>
              </div>
            )}
          </FeedCard>
        )}
        {reached("DEPENDENCIES_ANALYZED") && (
          <FeedCard key="dep" icon={<GitBranch className="h-3.5 w-3.5" />} title="DEPENDENCY CASCADE" at={t("DEPENDENCIES_ANALYZED")?.at} tone="crit">
            <p className="text-xs text-ink/85">{t("DEPENDENCIES_ANALYZED")?.detail}</p>
            <div className="mt-2">
              <span className="label">AFFECTED INFRASTRUCTURE ({result.affected_infrastructure.length})</span>
              <ImpactList nodes={result.affected_infrastructure} />
            </div>
            <div className="mt-1">
              <span className="label">AFFECTED SERVICES ({result.affected_services.length})</span>
              <ImpactList nodes={result.affected_services} />
            </div>
          </FeedCard>
        )}
        {reached("INCIDENT_DETECTED") && result.incident && (
          <FeedCard key="inc" icon={<Siren className="h-3.5 w-3.5" />} title="INCIDENT DETECTED" at={t("INCIDENT_DETECTED")?.at} tone="crit">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={result.incident.status} />
              <span className="font-mono text-2xs text-dim">INC-{shortId(result.incident.id)}</span>
            </div>
            <p className="mt-1 text-sm text-ink">{result.incident.title}</p>
            <Link
              href={`/command/incidents/${result.incident.id}`}
              className="mt-1 inline-flex items-center gap-1 font-mono text-2xs text-cyan hover:underline"
            >
              OPEN INCIDENT <ArrowRight className="h-3 w-3" />
            </Link>
          </FeedCard>
        )}
        {reached("RISK_ASSESSED") && result.risk && (
          <FeedCard key="risk" icon={<Gauge className="h-3.5 w-3.5" />} title="RISK ASSESSED" at={t("RISK_ASSESSED")?.at}>
            <RiskBlock risk={result.risk} compact />
          </FeedCard>
        )}
        {reached("AI_ANALYSIS") && result.ai_analysis && (
          <FeedCard key="ai" icon={<BrainCircuit className="h-3.5 w-3.5" />} title="AI ANALYSIS" at={t("AI_ANALYSIS")?.at}>
            <AIAnalysisView analysis={result.ai_analysis} compact />
          </FeedCard>
        )}
        {reached("RECOMMENDATIONS") && (
          <FeedCard key="rec" icon={<ClipboardList className="h-3.5 w-3.5" />} title={`RECOMMENDATIONS (${result.recommendations.length})`} at={t("RECOMMENDATIONS")?.at}>
            <p className="mb-2 text-xs text-muted">{t("RECOMMENDATIONS")?.detail}</p>
            <div className="space-y-2">
              {result.recommendations.map((r) => (
                <RecommendationCard key={r.id} rec={liveById.get(r.id) ?? r} dense />
              ))}
            </div>
          </FeedCard>
        )}
        {reached("AUDIT") && (
          <FeedCard key="audit" icon={<ScrollText className="h-3.5 w-3.5" />} title="AUDIT" at={t("AUDIT")?.at}>
            <p className="text-xs text-ink/85">
              {result.audit.recorded ? "Recorded" : "Not recorded"} · {result.audit.entries} audit entries (incl. SIMULATION_RUN)
            </p>
            <Link href="/command/audit" className="mt-1 inline-flex items-center gap-1 font-mono text-2xs text-cyan hover:underline">
              VIEW AUDIT TRAIL <ArrowRight className="h-3 w-3" />
            </Link>
          </FeedCard>
        )}
      </AnimatePresence>
    </div>
  );
}

function FeedCard({
  icon,
  title,
  at,
  tone,
  children,
}: {
  icon: ReactNode;
  title: string;
  at?: string;
  tone?: "crit";
  children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, x: 16, backgroundColor: "rgba(34,211,238,0.10)" }}
      animate={{ opacity: 1, x: 0, backgroundColor: "rgba(34,211,238,0)" }}
      transition={{ duration: 0.5 }}
      className="px-3 py-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={tone === "crit" ? "text-red" : "text-cyan"}>{icon}</span>
        <span className={`font-mono text-xs tracking-[0.18em] ${tone === "crit" ? "text-red" : "text-ink"}`}>{title}</span>
        <span className="ml-auto font-mono text-2xs text-dim">{formatTime(at)}</span>
      </div>
      {children}
    </motion.section>
  );
}

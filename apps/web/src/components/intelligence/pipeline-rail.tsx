"use client";

import { motion } from "framer-motion";
import {
  Activity,
  BrainCircuit,
  Check,
  ClipboardList,
  GitBranch,
  Gauge,
  Loader2,
  MapPin,
  ScrollText,
  Siren,
  UserCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type StageStatus = "pending" | "active" | "done" | "skipped";

export interface Stage {
  key: string;
  label: string;
  detail?: string;
  status: StageStatus;
}

export const STEP_META: Record<string, { label: string; icon: LucideIcon }> = {
  INITIALIZING: { label: "Initializing", icon: Loader2 },
  EVENT_CREATED: { label: "Event", icon: Zap },
  INFRASTRUCTURE_CONTEXT: { label: "Infrastructure Context", icon: MapPin },
  DEPENDENCIES_ANALYZED: { label: "Dependency Analysis", icon: GitBranch },
  INCIDENT_DETECTED: { label: "Incident Detected", icon: Siren },
  NO_INCIDENT: { label: "No Incident", icon: Activity },
  RISK_ASSESSED: { label: "Risk Assessment", icon: Gauge },
  AI_ANALYSIS: { label: "AI Analysis", icon: BrainCircuit },
  RECOMMENDATIONS: { label: "Recommendations", icon: ClipboardList },
  HUMAN_DECISION: { label: "Human Decision", icon: UserCheck },
  AUDIT: { label: "Audit", icon: ScrollText },
};

export function PipelineRail({
  stages,
  orientation = "vertical",
  className,
}: {
  stages: Stage[];
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  if (orientation === "horizontal") {
    return (
      <div className={cn("flex items-stretch gap-0 overflow-x-auto", className)}>
        {stages.map((s, i) => {
          const meta = STEP_META[s.key] ?? { label: s.label, icon: Activity };
          const Icon = meta.icon;
          return (
            <div key={s.key} className="flex min-w-0 flex-1 items-center">
              {i > 0 && (
                <div className="relative h-px w-full min-w-[12px] flex-1 bg-line">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-cyan"
                    initial={false}
                    animate={{ width: s.status === "pending" ? "0%" : "100%" }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              )}
              <div
                title={s.detail}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-1 px-1.5 text-center",
                  s.status === "pending" && "opacity-40",
                )}
              >
                <StageIcon status={s.status} Icon={Icon} />
                <span
                  className={cn(
                    "max-w-[86px] font-mono text-[9px] uppercase leading-tight tracking-wider",
                    s.status === "active" ? "text-cyan" : s.status === "done" ? "text-ink/80" : "text-dim",
                  )}
                >
                  {s.label || meta.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <ol className={cn("relative space-y-0", className)}>
      {stages.map((s, i) => {
        const meta = STEP_META[s.key] ?? { label: s.label, icon: Activity };
        const Icon = meta.icon;
        const last = i === stages.length - 1;
        return (
          <li key={s.key} className="relative flex gap-3 pb-3">
            {!last && (
              <span className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-line">
                <motion.span
                  className="absolute inset-x-0 top-0 block bg-cyan"
                  initial={false}
                  animate={{ height: s.status === "done" ? "100%" : "0%" }}
                  transition={{ duration: 0.4 }}
                />
              </span>
            )}
            <StageIcon status={s.status} Icon={Icon} />
            <div className={cn("min-w-0 flex-1 pt-0.5", s.status === "pending" && "opacity-40")}>
              <div
                className={cn(
                  "font-mono text-xs uppercase tracking-[0.14em]",
                  s.status === "active" ? "text-cyan" : s.status === "done" ? "text-ink" : "text-muted",
                )}
              >
                {s.label || meta.label}
              </div>
              {s.detail && s.status !== "pending" && (
                <motion.p
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-0.5 text-xs leading-snug text-muted"
                >
                  {s.detail}
                </motion.p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StageIcon({ status, Icon }: { status: StageStatus; Icon: LucideIcon }) {
  return (
    <span
      className={cn(
        "relative flex h-7 w-7 shrink-0 items-center justify-center border",
        status === "done" && "border-cyan/60 bg-cyan/10 text-cyan",
        status === "active" && "border-cyan bg-cyan/20 text-cyan shadow-glow",
        status === "pending" && "border-line bg-panel text-dim",
        status === "skipped" && "border-line bg-panel text-dim line-through",
      )}
    >
      {status === "active" && <span className="absolute inset-0 animate-pulse-ring border border-cyan" />}
      {status === "done" ? <Check className="h-3.5 w-3.5" /> : <Icon className={cn("h-3.5 w-3.5", status === "active" && Icon === Loader2 && "animate-spin")} />}
    </span>
  );
}

/** Build rail stages from a list of executed backend step codes, revealing up to `activeIndex`. */
export function stagesFromSteps(
  steps: { step: string; label?: string; detail?: string }[],
  activeIndex: number,
): Stage[] {
  return steps.map((s, i) => ({
    key: s.step,
    label: STEP_META[s.step]?.label ?? s.label ?? s.step,
    detail: s.detail,
    status: i < activeIndex ? "done" : i === activeIndex ? "active" : "pending",
  }));
}

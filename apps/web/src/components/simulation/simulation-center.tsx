"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, Play, RotateCcw, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGraph, useRunSimulation, useScenarios } from "@/hooks/use-vaynex";
import { useRole } from "@/hooks/use-session";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import { humanize } from "@/lib/utils/format";
import { useUI } from "@/store/ui";
import type { DependencyGraph, ScenarioInfo, SimulationRunResponse } from "@/types";
import { Badge, LevelBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/components/shell/page-header";
import { NetworkView } from "@/components/3d/network-view";
import { NetworkLegend } from "@/components/network/node-inspector";
import { PipelineRail, stagesFromSteps, type Stage } from "@/components/intelligence/pipeline-rail";
import { SimulationFeed } from "./simulation-feed";

const PRIMARY_SCENARIO = "hospital_power_failure";
const STEP_MS: Record<string, number> = { AI_ANALYSIS: 1900, RECOMMENDATIONS: 1600, DEPENDENCIES_ANALYZED: 2000 };
const DEFAULT_STEP_MS = 1300;

export function SimulationCenter() {
  const router = useRouter();
  const params = useSearchParams();
  const demo = params.get("demo") === "1";
  const { canOperate } = useRole();

  const scenarios = useScenarios();
  const graph = useGraph();
  const run = useRunSimulation();

  const phase = useUI((s) => s.simulationPhase);
  const setPhase = useUI((s) => s.setSimulationPhase);
  const activeStep = useUI((s) => s.activeStep);
  const setActiveStep = useUI((s) => s.setActiveStep);
  const setResult = useUI((s) => s.setSimulationResult);
  const setDemoMode = useUI((s) => s.setDemoMode);

  const [selected, setSelected] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState(true);
  const [result, setLocalResult] = useState<SimulationRunResponse | null>(null);
  const [snapshot, setSnapshot] = useState<DependencyGraph | null>(null);
  const [depthTick, setDepthTick] = useState(-1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const autoStarted = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Default selection: primary demo scenario if the backend offers it, else the first one.
  const scenarioList = useMemo(() => scenarios.data ?? [], [scenarios.data]);
  useEffect(() => {
    if (!selected && scenarioList.length) {
      setSelected(scenarioList.find((s) => s.key === PRIMARY_SCENARIO)?.key ?? scenarioList[0].key);
    }
  }, [scenarioList, selected]);

  const start = useCallback(
    (key: string) => {
      setLocalResult(null);
      setResult(null);
      setSnapshot(graph.data ?? null); // freeze the pre-event picture for the cinematic reveal
      setDepthTick(-1);
      setActiveStep(-1);
      setCountdown(null);
      setPhase("requesting");
      run.mutate(
        { scenario: key, apply_status_changes: applyStatus },
        {
          onSuccess: (res) => {
            setResult(res);
            if (!mounted.current) return;
            setLocalResult(res);
            setActiveStep(0);
            setPhase("playing");
          },
          onError: () => {
            if (mounted.current) setPhase("error");
          },
        },
      );
    },
    [applyStatus, graph.data, run, setActiveStep, setPhase, setResult],
  );

  // Demo mode: pick the primary scenario and run automatically once.
  useEffect(() => {
    setDemoMode(demo);
    if (!demo || autoStarted.current || !canOperate || !scenarioList.length || graph.isLoading) return;
    autoStarted.current = true;
    const key = scenarioList.find((s) => s.key === PRIMARY_SCENARIO)?.key ?? scenarioList[0].key;
    setSelected(key);
    start(key);
  }, [demo, canOperate, scenarioList, graph.isLoading, start, setDemoMode]);

  // Timeline playback — driven exclusively by the backend's timeline[].
  const timeline = useMemo(() => result?.timeline ?? [], [result]);
  useEffect(() => {
    if (phase !== "playing" || !timeline.length) return;
    if (activeStep >= timeline.length) {
      setPhase("complete");
      return;
    }
    const step = timeline[activeStep]?.step;
    const t = setTimeout(() => setActiveStep(activeStep + 1), (step ? STEP_MS[step] : undefined) ?? DEFAULT_STEP_MS);
    return () => clearTimeout(t);
  }, [phase, activeStep, timeline, setActiveStep, setPhase]);

  // Propagation: reveal impact depth-by-depth while dependencies are being analysed.
  const reached = useCallback(
    (code: string) => {
      const idx = timeline.findIndex((t) => t.step === code);
      return idx >= 0 && (phase === "complete" || activeStep >= idx);
    },
    [timeline, activeStep, phase],
  );
  const impact = useMemo(
    () => (result ? [...result.affected_infrastructure, ...result.affected_services] : []),
    [result],
  );
  const impactIds = useMemo(() => impact.map((n) => n.id), [impact]);
  const depthById = useMemo(() => Object.fromEntries(impact.map((n) => [n.id, n.depth])), [impact]);
  const originId = impact.find((n) => n.relationship === "ORIGIN")?.id ?? result?.event.infrastructure_id ?? null;
  const maxDepth = impact.reduce((m, n) => Math.max(m, n.depth), 0);
  const depsReached = reached("DEPENDENCIES_ANALYZED");
  useEffect(() => {
    if (!depsReached) return;
    if (depthTick >= maxDepth) return;
    const t = setTimeout(() => setDepthTick((d) => d + 1), 380);
    return () => clearTimeout(t);
  }, [depsReached, depthTick, maxDepth]);
  const revealDepth = !result ? -1 : depsReached ? Math.max(0, depthTick) : reached("EVENT_CREATED") ? 0 : -1;

  // Demo: return to the command center with refreshed state.
  useEffect(() => {
    if (phase === "complete" && demo) setCountdown(12);
  }, [phase, demo]);
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      router.push("/command");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, router]);

  // Reset global phase when leaving the page mid-run.
  useEffect(
    () => () => {
      const s = useUI.getState();
      if (s.simulationPhase !== "idle") s.setSimulationPhase("idle");
      s.setDemoMode(false);
    },
    [],
  );

  const stages: Stage[] = useMemo(() => {
    const init: Stage = {
      key: "INITIALIZING",
      label: "Initializing",
      detail: phase === "requesting" ? "Running the real event pipeline on the backend…" : "Scenario dispatched",
      status: phase === "requesting" ? "active" : result ? "done" : "pending",
    };
    if (!result) {
      const placeholders = [
        "EVENT_CREATED",
        "INFRASTRUCTURE_CONTEXT",
        "DEPENDENCIES_ANALYZED",
        "INCIDENT_DETECTED",
        "RISK_ASSESSED",
        "AI_ANALYSIS",
        "RECOMMENDATIONS",
        "AUDIT",
        "HUMAN_DECISION",
      ].map((k) => ({ key: k, label: "", status: "pending" as const }));
      return [init, ...placeholders];
    }
    const idx = phase === "complete" ? timeline.length : activeStep;
    return [init, ...stagesFromSteps(timeline, idx)];
  }, [result, timeline, activeStep, phase]);

  const displayGraph = phase === "complete" ? graph.data ?? snapshot : snapshot ?? graph.data;
  const currentScenario = scenarioList.find((s) => s.key === selected) ?? null;
  const busy = phase === "requesting" || phase === "playing";

  return (
    <div className="flex flex-col gap-3 p-4">
      <PageHeader
        code="06 · SIMULATION CENTER"
        title={demo ? "Vaynex Demo" : "Disruption Simulation"}
        subtitle="Runs a scripted event through the real backend pipeline — dependency cascade, incident, risk, AI analysis, recommendations, audit — then hands the decision to a human."
        actions={
          <>
            <label className="flex cursor-pointer items-center gap-2 font-mono text-2xs text-muted">
              <input
                type="checkbox"
                checked={applyStatus}
                onChange={(e) => setApplyStatus(e.target.checked)}
                className="accent-cyan"
                disabled={busy}
              />
              APPLY STATUS CHANGES
            </label>
            <Button
              variant="solid"
              size="lg"
              disabled={!selected || busy || !canOperate}
              onClick={() => selected && start(selected)}
              title={canOperate ? undefined : "Requires OPERATOR role"}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : phase === "complete" ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
              {busy ? "Simulating" : phase === "complete" ? "Run again" : "Run simulation"}
            </Button>
          </>
        }
      />

      {!canOperate && (
        <div className="border border-amber/40 bg-amber-soft/30 px-3 py-2 font-mono text-xs text-amber">
          VIEWER ROLE — scenarios are visible, but running a simulation requires OPERATOR or ADMIN.
        </div>
      )}

      <Panel bodyClassName="px-3 py-3" tone={busy ? "accent" : "default"}>
        <PipelineRail stages={stages} orientation="horizontal" />
      </Panel>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px,1fr,420px]">
        {/* Scenarios */}
        <Panel title="SCENARIOS" code="SC" bodyClassName="p-2 space-y-2" className="xl:max-h-[680px]">
          {scenarios.isLoading ? (
            <LoadingState label="LOADING SCENARIOS" />
          ) : scenarios.isError ? (
            <ErrorState error={scenarios.error} onRetry={() => void scenarios.refetch()} />
          ) : scenarioList.length === 0 ? (
            <EmptyState title="NO SCENARIOS" />
          ) : (
            scenarioList.map((s) => (
              <ScenarioCard
                key={s.key}
                s={s}
                selected={s.key === selected}
                primary={s.key === PRIMARY_SCENARIO}
                disabled={busy}
                onSelect={() => setSelected(s.key)}
              />
            ))
          )}
        </Panel>

        {/* 3D */}
        <Panel
          title="CASCADE VISUALIZATION"
          code="3D"
          bodyClassName="relative p-0"
          className="min-h-[560px]"
          tone={result && revealDepth >= 0 ? "crit" : "default"}
          actions={
            currentScenario && (
              <span className="font-mono text-2xs text-muted">ORIGIN · {currentScenario.origin.toUpperCase()}</span>
            )
          }
        >
          <div className="absolute inset-0">
            {displayGraph ? (
              <NetworkView
                graph={displayGraph}
                affected={result && revealDepth >= 0 ? impactIds : undefined}
                origin={originId}
                depthById={depthById}
                revealDepth={revealDepth}
                autoRotate={!busy}
              />
            ) : graph.isError ? (
              <ErrorState error={graph.error} onRetry={() => void graph.refetch()} title="NETWORK UNAVAILABLE" />
            ) : (
              <LoadingState label="MAPPING DEPENDENCIES" />
            )}
          </div>
          <div className="pointer-events-none absolute left-3 top-3">
            <NetworkLegend />
          </div>
          <AnimatePresence>
            {phase === "requesting" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg/40"
              >
                <div className="border border-cyan/50 bg-panel/90 px-4 py-3 text-center shadow-glow">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-cyan" />
                  <p className="mt-2 font-mono text-xs tracking-[0.2em] text-cyan">INITIALIZING SIMULATION</p>
                  <p className="mt-1 font-mono text-2xs text-muted">{currentScenario?.name}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {result && currentScenario && (
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-1.5 border border-line bg-panel/90 px-2.5 py-1.5 font-mono text-2xs text-muted">
              <span className="text-dim">CHAIN</span>
              {currentScenario.chain.map((c, i) => (
                <span key={c} className="flex items-center gap-1.5">
                  {i > 0 && <ArrowRight className="h-3 w-3 text-red/70" />}
                  <span className={revealDepth >= i ? "text-ink" : undefined}>{c}</span>
                </span>
              ))}
            </div>
          )}
        </Panel>

        {/* Feed */}
        <Panel title="INTELLIGENCE FEED" code="IF" bodyClassName="p-0 overflow-y-auto" className="xl:max-h-[680px]">
          {phase === "error" ? (
            <ErrorState
              title="SIMULATION FAILED"
              error={run.error}
              onRetry={() => selected && start(selected)}
            />
          ) : result ? (
            <SimulationFeed result={result} reached={reached} />
          ) : (
            <EmptyState
              title={busy ? "AWAITING PIPELINE RESPONSE" : "READY"}
              hint={
                busy
                  ? "The backend is executing the event pipeline."
                  : "Select a scenario and run it. Every value shown here comes from the backend response."
              }
            />
          )}
        </Panel>
      </div>

      {/* Human decision & return */}
      <AnimatePresence>
        {result && reached("HUMAN_DECISION") && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-4 border border-amber/50 bg-amber-soft/20 px-4 py-3"
          >
            <UserCheck className="h-6 w-6 text-amber" />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs tracking-[0.2em] text-amber">
                HUMAN DECISION {result.human_decision.required ? "REQUIRED" : "NOT REQUIRED"} ·{" "}
                {result.human_decision.pending_recommendations} PENDING
              </div>
              <p className="mt-0.5 text-sm text-ink/85">{result.human_decision.message}</p>
            </div>
            <div className="flex items-center gap-2">
              {result.incident && (
                <Link href={`/command/incidents/${result.incident.id}`}>
                  <Button variant="primary">
                    <ShieldCheck className="h-3.5 w-3.5" /> Review & decide
                  </Button>
                </Link>
              )}
              <Button variant="outline" onClick={() => router.push("/command")}>
                Command center {countdown !== null && countdown > 0 ? `(${countdown})` : ""}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              {countdown !== null && (
                <Button variant="ghost" size="sm" onClick={() => setCountdown(null)}>
                  Stay
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {run.isError && phase === "error" && (
        <p className="font-mono text-2xs text-red">{errorMessage(run.error)}</p>
      )}
    </div>
  );
}

function ScenarioCard({
  s,
  selected,
  primary,
  disabled,
  onSelect,
}: {
  s: ScenarioInfo;
  selected: boolean;
  primary: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full border p-2.5 text-left transition-colors disabled:cursor-not-allowed",
        selected ? "border-cyan/60 bg-cyan/5 shadow-glow" : "border-line bg-bg/40 hover:border-line-strong",
      )}
    >
      <div className="flex items-center gap-1.5">
        <LevelBadge level={s.severity} />
        <Badge tone="neutral">{humanize(s.event_type)}</Badge>
        {primary && <Badge tone="accent">PRIMARY</Badge>}
      </div>
      <div className="mt-1.5 text-sm font-medium text-ink">{s.name}</div>
      <p className="mt-0.5 line-clamp-3 text-xs text-muted">{s.description}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 font-mono text-[10px] text-dim">
        {s.chain.map((c, i) => (
          <span key={c} className="flex items-center gap-1">
            {i > 0 && <ArrowRight className="h-2.5 w-2.5" />}
            {c}
          </span>
        ))}
      </div>
      <div className="mt-1 font-mono text-[9px] text-dim">KEY {s.key}</div>
    </button>
  );
}

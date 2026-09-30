import type { ISODate, UUID } from "./common";
import type { ImpactNode } from "./dependency";
import type { VaynexEvent } from "./event";
import type { Incident } from "./incident";
import type { AIAnalysis } from "./intelligence";
import type { Recommendation } from "./recommendation";
import type { RiskFactor } from "./risk";

/** Scenario keys come from GET /simulation/scenarios — never hardcoded in the UI. */
export interface ScenarioInfo {
  key: string;
  name: string;
  description: string;
  event_type: string;
  severity: string;
  origin: string;
  chain: string[];
}

export interface SimulationRunRequest {
  scenario: string;
  apply_status_changes?: boolean;
}

export interface SimulationRisk {
  score: number;
  level: string;
  impact_score: number;
  likelihood_score: number;
  explanation: string;
  factors: RiskFactor[];
}

export interface TimelineStep {
  step: string;
  label: string;
  detail: string;
  at: ISODate;
}

export interface HumanDecision {
  required: boolean;
  pending_recommendations: number;
  message: string;
}

export interface AuditStatus {
  recorded: boolean;
  entries: number;
}

export interface SimulationRunResponse {
  simulation_id: UUID;
  scenario: string;
  event: VaynexEvent;
  incident: Incident | null;
  risk: SimulationRisk | null;
  affected_infrastructure: ImpactNode[];
  affected_services: ImpactNode[];
  ai_analysis: AIAnalysis | null;
  recommendations: Recommendation[];
  human_decision: HumanDecision;
  timeline: TimelineStep[];
  audit: AuditStatus;
}

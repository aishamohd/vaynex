import type { Criticality, ISODate, RiskLevel, Severity, UUID } from "./common";
import type { DependencyStrength } from "./dependency";

export interface RiskFactor {
  name: string;
  input: unknown;
  weight: number;
  max_points: number;
  points: number;
  description: string;
}

export interface Risk {
  id: UUID;
  incident_id: UUID;
  score: number;
  level: RiskLevel;
  impact_score: number;
  likelihood_score: number;
  affected_services_count: number;
  affected_infrastructure_count: number;
  explanation: string;
  factors: RiskFactor[];
  created_at: ISODate;
}

export interface RiskHistory {
  incident_id: UUID;
  latest: Risk | null;
  history: Risk[];
}

export interface RiskEvaluateRequest {
  event_severity: Severity;
  event_type?: string | null;
  origin_criticality?: Criticality | null;
  dependency_strengths?: DependencyStrength[];
  affected_infrastructure_criticalities?: Criticality[];
  affected_service_criticalities?: Criticality[];
}

export interface RiskEvaluateResponse {
  score: number;
  level: RiskLevel;
  impact_score: number;
  likelihood_score: number;
  affected_infrastructure_count: number;
  affected_services_count: number;
  explanation: string;
  factors: RiskFactor[];
}

/** Minimal shape shared by Risk, RiskEvaluateResponse and SimulationRisk. */
export interface RiskLike {
  score: number;
  level: string;
  impact_score: number;
  likelihood_score: number;
  explanation: string;
  factors: RiskFactor[];
}

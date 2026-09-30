import type { ISODate, RiskLevel, Severity, UUID } from "./common";
import type { ImpactNode } from "./dependency";
import type { AIAnalysis } from "./intelligence";
import type { Recommendation } from "./recommendation";
import type { Risk } from "./risk";

export type IncidentStatus = "OPEN" | "INVESTIGATING" | "MITIGATING" | "RESOLVED";
export const INCIDENT_STATUSES: IncidentStatus[] = ["OPEN", "INVESTIGATING", "MITIGATING", "RESOLVED"];

export interface RiskSummary {
  score: number;
  level: RiskLevel;
}

export interface Incident {
  id: UUID;
  event_id: UUID;
  title: string;
  description: string | null;
  status: IncidentStatus;
  severity: Severity;
  detected_at: ISODate;
  resolved_at: ISODate | null;
  resolution_note?: string | null;
  affected_infrastructure_count: number;
  affected_services_count: number;
  risk?: RiskSummary | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface IncidentEventSummary {
  id: UUID;
  event_type: string;
  source: string;
  severity: string;
  title: string;
  description: string | null;
  infrastructure_id: UUID | null;
  service_id: UUID | null;
  latitude: number | null;
  longitude: number | null;
  payload: Record<string, unknown>;
  occurred_at: ISODate;
}

export interface IncidentDetail extends Incident {
  event: IncidentEventSummary | null;
  affected_infrastructure: ImpactNode[];
  affected_services: ImpactNode[];
  risk_assessment: Risk | null;
  recommendations: Recommendation[];
  ai_analysis: AIAnalysis | null;
}

export interface IncidentFilters {
  status?: IncidentStatus | "";
  severity?: Severity | "";
  active_only?: boolean;
  limit?: number;
  offset?: number;
}

export interface IncidentResolveRequest {
  resolution_note?: string | null;
  restore_asset_status?: boolean;
}

import type { ISODate, UUID } from "./common";

export interface AuditLog {
  id: UUID;
  user_id: UUID | null;
  action: string;
  entity_type: string;
  entity_id: UUID | null;
  details: Record<string, unknown>;
  created_at: ISODate;
}

export interface AuditFilters {
  action?: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  limit?: number;
  offset?: number;
}

export const AUDIT_ACTIONS = [
  "USER_REGISTERED",
  "USER_LOGIN",
  "USER_LOGIN_FAILED",
  "ORGANIZATION_CREATED",
  "INFRASTRUCTURE_CREATED",
  "INFRASTRUCTURE_UPDATED",
  "INFRASTRUCTURE_DELETED",
  "SERVICE_CREATED",
  "SERVICE_UPDATED",
  "DEPENDENCY_CREATED",
  "EVENT_CREATED",
  "INCIDENT_CREATED",
  "INCIDENT_UPDATED",
  "RISK_CALCULATED",
  "AI_ANALYSIS_CREATED",
  "RECOMMENDATION_CREATED",
  "RECOMMENDATION_ACCEPTED",
  "RECOMMENDATION_REJECTED",
  "RECOMMENDATION_COMPLETED",
  "INCIDENT_RESOLVED",
  "SIMULATION_RUN",
] as const;

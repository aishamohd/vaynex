import type { ISODate, Severity, UUID } from "./common";
import type { ImpactNode } from "./dependency";
import type { Incident } from "./incident";
import type { AIAnalysis } from "./intelligence";
import type { Recommendation } from "./recommendation";
import type { Risk } from "./risk";

export type EventType =
  | "POWER_FAILURE"
  | "WATER_DISRUPTION"
  | "TELECOM_OUTAGE"
  | "FLOOD"
  | "EQUIPMENT_FAILURE"
  | "CYBER_INCIDENT"
  | "FIRE"
  | "EARTHQUAKE"
  | "TRAFFIC_DISRUPTION"
  | "SENSOR_ALERT"
  | "OTHER";

export const EVENT_TYPES: EventType[] = [
  "POWER_FAILURE",
  "WATER_DISRUPTION",
  "TELECOM_OUTAGE",
  "FLOOD",
  "EQUIPMENT_FAILURE",
  "CYBER_INCIDENT",
  "FIRE",
  "EARTHQUAKE",
  "TRAFFIC_DISRUPTION",
  "SENSOR_ALERT",
  "OTHER",
];

export interface EventCreate {
  event_type: EventType;
  source: string;
  severity: Severity;
  title: string;
  description?: string | null;
  infrastructure_id?: UUID | null;
  service_id?: UUID | null;
  latitude?: number | null;
  longitude?: number | null;
  payload?: Record<string, unknown>;
  occurred_at?: ISODate | null;
}

export interface VaynexEvent {
  id: UUID;
  event_type: EventType;
  source: string;
  severity: Severity;
  title: string;
  description: string | null;
  infrastructure_id: UUID | null;
  service_id: UUID | null;
  latitude: number | null;
  longitude: number | null;
  payload: Record<string, unknown>;
  occurred_at: ISODate;
  created_at: ISODate;
}

export interface EventProcessingResult {
  event: VaynexEvent;
  incident_created: boolean;
  incident: Incident | null;
  risk: Risk | null;
  affected_infrastructure: ImpactNode[];
  affected_services: ImpactNode[];
  ai_analysis: AIAnalysis | null;
  recommendations: Recommendation[];
  pipeline: string[];
}

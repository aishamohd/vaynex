import type { ISODate, UUID } from "./common";
import type { Incident } from "./incident";

export interface DashboardEvent {
  id: UUID;
  event_type: string;
  severity: string;
  title: string;
  source: string;
  occurred_at: ISODate;
}

export interface DashboardInfrastructure {
  id: UUID;
  name: string;
  infrastructure_type: string;
  status: string;
  criticality: string;
  latitude: number | null;
  longitude: number | null;
}

export interface DashboardOverview {
  total_infrastructure: number;
  operational_infrastructure: number;
  degraded_infrastructure: number;
  failed_infrastructure: number;
  maintenance_infrastructure: number;
  total_services: number;
  disrupted_services: number;
  active_incidents: number;
  critical_incidents: number;
  average_risk: number;
  pending_recommendations: number;
  recent_events: DashboardEvent[];
  recent_incidents: Incident[];
  critical_infrastructure: DashboardInfrastructure[];
  generated_at: ISODate;
  cached: boolean;
}

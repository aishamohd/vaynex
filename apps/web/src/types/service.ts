import type { Criticality, ISODate, UUID } from "./common";

export type ServiceType =
  | "EMERGENCY_HEALTHCARE"
  | "HEALTHCARE"
  | "POWER_SUPPLY"
  | "WATER_SUPPLY"
  | "TELECOMMUNICATIONS"
  | "EMERGENCY_COMMUNICATIONS"
  | "EMERGENCY_RESPONSE"
  | "TRANSPORTATION"
  | "PUBLIC_EDUCATION"
  | "DATA_SERVICES"
  | "PUBLIC_SAFETY"
  | "OTHER";

export type ServiceStatus = "OPERATIONAL" | "DEGRADED" | "DISRUPTED" | "SUSPENDED";

export interface PublicService {
  id: UUID;
  organization_id: UUID;
  name: string;
  service_type: ServiceType;
  status: ServiceStatus;
  criticality: Criticality;
  description: string | null;
  infrastructure_id: UUID | null;
  created_at: ISODate;
  updated_at: ISODate;
}

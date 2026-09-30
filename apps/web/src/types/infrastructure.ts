import type { Criticality, ISODate, UUID } from "./common";

export type InfrastructureType =
  | "POWER_PLANT"
  | "POWER_SUBSTATION"
  | "HOSPITAL"
  | "WATER_TREATMENT"
  | "WATER_PIPELINE"
  | "TELECOM_TOWER"
  | "ROAD"
  | "BRIDGE"
  | "SCHOOL"
  | "DATA_CENTER"
  | "EMERGENCY_CENTER";

export const INFRASTRUCTURE_TYPES: InfrastructureType[] = [
  "POWER_PLANT",
  "POWER_SUBSTATION",
  "HOSPITAL",
  "WATER_TREATMENT",
  "WATER_PIPELINE",
  "TELECOM_TOWER",
  "ROAD",
  "BRIDGE",
  "SCHOOL",
  "DATA_CENTER",
  "EMERGENCY_CENTER",
];

export type InfrastructureStatus = "OPERATIONAL" | "DEGRADED" | "FAILED" | "MAINTENANCE";
export const INFRASTRUCTURE_STATUSES: InfrastructureStatus[] = ["OPERATIONAL", "DEGRADED", "FAILED", "MAINTENANCE"];

export interface Infrastructure {
  id: UUID;
  organization_id: UUID;
  name: string;
  infrastructure_type: InfrastructureType;
  status: InfrastructureStatus;
  criticality: Criticality;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface InfrastructureFilters {
  organization_id?: string;
  type?: InfrastructureType | "";
  status?: InfrastructureStatus | "";
  criticality?: Criticality | "";
  search?: string;
  limit?: number;
  offset?: number;
}

export type OrganizationType =
  | "MUNICIPAL"
  | "HEALTHCARE"
  | "POWER_UTILITY"
  | "WATER_UTILITY"
  | "TELECOM"
  | "EMERGENCY_SERVICES"
  | "TRANSPORT"
  | "OTHER";

export interface Organization {
  id: UUID;
  name: string;
  organization_type: OrganizationType;
  description: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

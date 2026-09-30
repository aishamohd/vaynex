import type { EntityKind, ISODate, UUID } from "./common";

export type DependencyType =
  | "POWER"
  | "WATER"
  | "TELECOM"
  | "TRANSPORT"
  | "DATA"
  | "OPERATIONAL"
  | "SERVICE_DELIVERY";

export type DependencyStrength = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface NodeRef {
  id: UUID;
  kind: EntityKind;
  name: string;
  type: string;
  status: string;
  criticality: string;
}

export interface Dependency {
  id: UUID;
  source_infrastructure_id: UUID | null;
  source_service_id: UUID | null;
  target_infrastructure_id: UUID | null;
  target_service_id: UUID | null;
  dependency_type: DependencyType;
  strength: DependencyStrength;
  description: string | null;
  source?: NodeRef | null;
  target?: NodeRef | null;
  created_at: ISODate;
}

export type ImpactRelationship = "ORIGIN" | "DIRECT_EXPOSURE" | "DEPENDENCY" | "HOSTED_SERVICE";

export interface ImpactNode {
  id: UUID;
  kind: EntityKind;
  name: string;
  type: string;
  criticality: string;
  status: string;
  previous_status?: string | null;
  relationship: ImpactRelationship | string;
  depth: number;
  impact_weight: number;
  dependency_type?: string | null;
  dependency_strength?: string | null;
  path: string[];
  distance_m?: number | null;
}

export interface InfrastructureDependencies {
  infrastructure_id: UUID;
  upstream: Dependency[];
  downstream: Dependency[];
  hosted_services: NodeRef[];
  affected_infrastructure: ImpactNode[];
  affected_services: ImpactNode[];
}

export interface GraphNode {
  id: UUID;
  kind: EntityKind;
  name: string;
  type: string;
  status: string;
  criticality: string;
  organization_id: UUID;
  latitude?: number | null;
  longitude?: number | null;
}

export interface GraphEdge {
  id: string;
  /** Target depends on source. */
  source: UUID;
  target: UUID;
  dependency_type: string;
  strength: string;
  implicit: boolean;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from packages.common.enums import DependencyStrength, DependencyType, EntityKind


class DependencyCreate(BaseModel):
    """``target`` depends on ``source``. Provide exactly one source id and one target id."""

    source_infrastructure_id: uuid.UUID | None = None
    source_service_id: uuid.UUID | None = None
    target_infrastructure_id: uuid.UUID | None = None
    target_service_id: uuid.UUID | None = None
    dependency_type: DependencyType
    strength: DependencyStrength = DependencyStrength.MEDIUM
    description: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _exactly_one_each(self) -> DependencyCreate:
        sources = [self.source_infrastructure_id, self.source_service_id]
        targets = [self.target_infrastructure_id, self.target_service_id]
        if sum(v is not None for v in sources) != 1:
            raise ValueError("Provide exactly one of source_infrastructure_id or source_service_id")
        if sum(v is not None for v in targets) != 1:
            raise ValueError("Provide exactly one of target_infrastructure_id or target_service_id")
        if (self.source_infrastructure_id and self.source_infrastructure_id == self.target_infrastructure_id) or (
            self.source_service_id and self.source_service_id == self.target_service_id
        ):
            raise ValueError("An asset cannot depend on itself")
        return self


class NodeRef(BaseModel):
    id: uuid.UUID
    kind: EntityKind
    name: str
    type: str
    status: str
    criticality: str


class DependencyResponse(BaseModel):
    id: uuid.UUID
    source_infrastructure_id: uuid.UUID | None
    source_service_id: uuid.UUID | None
    target_infrastructure_id: uuid.UUID | None
    target_service_id: uuid.UUID | None
    dependency_type: DependencyType
    strength: DependencyStrength
    description: str | None
    source: NodeRef | None = None
    target: NodeRef | None = None
    created_at: datetime


class ImpactNode(BaseModel):
    """An asset or service affected by an event (result of impact analysis)."""

    id: uuid.UUID
    kind: EntityKind
    name: str
    type: str
    criticality: str
    status: str
    previous_status: str | None = None
    relationship: str
    depth: int
    impact_weight: float
    dependency_type: str | None = None
    dependency_strength: str | None = None
    path: list[str] = Field(default_factory=list)
    distance_m: float | None = None


class InfrastructureDependenciesResponse(BaseModel):
    infrastructure_id: uuid.UUID
    upstream: list[DependencyResponse] = Field(description="What this asset depends on")
    downstream: list[DependencyResponse] = Field(description="What depends on this asset")
    hosted_services: list[NodeRef]
    affected_infrastructure: list[ImpactNode] = Field(description="Transitive assets impacted if this asset fails")
    affected_services: list[ImpactNode] = Field(description="Transitive services impacted if this asset fails")


class GraphNode(BaseModel):
    id: uuid.UUID
    kind: EntityKind
    name: str
    type: str
    status: str
    criticality: str
    organization_id: uuid.UUID
    latitude: float | None = None
    longitude: float | None = None


class GraphEdge(BaseModel):
    id: str
    source: uuid.UUID
    target: uuid.UUID
    dependency_type: str
    strength: str
    implicit: bool = Field(description="True for hosting edges derived from service.infrastructure_id")


class DependencyGraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]

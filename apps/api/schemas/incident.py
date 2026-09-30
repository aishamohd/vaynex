from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from apps.api.schemas.dependency import ImpactNode
from apps.api.schemas.intelligence import AIAnalysisResponse
from apps.api.schemas.recommendation import RecommendationResponse
from apps.api.schemas.risk import RiskResponse
from packages.common.enums import IncidentStatus, RiskLevel, Severity


class RiskSummary(BaseModel):
    score: int
    level: RiskLevel


class IncidentResponse(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    title: str
    description: str | None
    status: IncidentStatus
    severity: Severity
    detected_at: datetime
    resolved_at: datetime | None
    resolution_note: str | None = None
    affected_infrastructure_count: int
    affected_services_count: int
    risk: RiskSummary | None = None
    created_at: datetime
    updated_at: datetime


class IncidentEventSummary(BaseModel):
    id: uuid.UUID
    event_type: str
    source: str
    severity: str
    title: str
    description: str | None
    infrastructure_id: uuid.UUID | None
    service_id: uuid.UUID | None
    latitude: float | None
    longitude: float | None
    payload: dict
    occurred_at: datetime


class IncidentDetailResponse(IncidentResponse):
    event: IncidentEventSummary | None
    affected_infrastructure: list[ImpactNode]
    affected_services: list[ImpactNode]
    risk_assessment: RiskResponse | None
    recommendations: list[RecommendationResponse]
    ai_analysis: AIAnalysisResponse | None


class IncidentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    status: Literal["OPEN", "INVESTIGATING", "MITIGATING"] | None = Field(
        default=None, description="Use POST /incidents/{id}/resolve to resolve"
    )


class IncidentResolveRequest(BaseModel):
    resolution_note: str | None = Field(default=None, max_length=5000)
    restore_asset_status: bool = Field(
        default=True,
        description="Restore affected infrastructure/services to their pre-incident status",
    )

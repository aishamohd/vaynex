from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator

from apps.api.schemas.common import ORMModel
from apps.api.schemas.dependency import ImpactNode
from apps.api.schemas.incident import IncidentResponse
from apps.api.schemas.intelligence import AIAnalysisResponse
from apps.api.schemas.recommendation import RecommendationResponse
from apps.api.schemas.risk import RiskResponse
from packages.common.enums import EventType, Severity


class EventCreate(BaseModel):
    event_type: EventType
    source: str = Field(min_length=1, max_length=120, examples=["grid-monitor"])
    severity: Severity
    title: str = Field(min_length=3, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    infrastructure_id: uuid.UUID | None = None
    service_id: uuid.UUID | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    payload: dict[str, Any] = Field(
        default_factory=dict,
        description="Free-form sensor data. Optional key `impact_radius_m` enables a PostGIS "
        "search for assets directly exposed around latitude/longitude.",
    )
    occurred_at: datetime | None = None

    @model_validator(mode="after")
    def _coords(self) -> EventCreate:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        return self


class EventResponse(ORMModel):
    id: uuid.UUID
    event_type: EventType
    source: str
    severity: Severity
    title: str
    description: str | None
    infrastructure_id: uuid.UUID | None
    service_id: uuid.UUID | None
    latitude: float | None
    longitude: float | None
    payload: dict[str, Any]
    occurred_at: datetime
    created_at: datetime


class EventProcessingResult(BaseModel):
    """Full outcome of the event pipeline (validate -> ... -> audit)."""

    event: EventResponse
    incident_created: bool
    incident: IncidentResponse | None = None
    risk: RiskResponse | None = None
    affected_infrastructure: list[ImpactNode] = Field(default_factory=list)
    affected_services: list[ImpactNode] = Field(default_factory=list)
    ai_analysis: AIAnalysisResponse | None = None
    recommendations: list[RecommendationResponse] = Field(default_factory=list)
    pipeline: list[str] = Field(default_factory=list, description="Pipeline steps executed, in order")

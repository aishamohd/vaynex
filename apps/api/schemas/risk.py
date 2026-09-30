from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from apps.api.schemas.common import ORMModel
from packages.common.enums import Criticality, DependencyStrength, RiskLevel, Severity


class RiskResponse(ORMModel):
    id: uuid.UUID
    incident_id: uuid.UUID
    score: int
    level: RiskLevel
    impact_score: int
    likelihood_score: int
    affected_services_count: int
    affected_infrastructure_count: int
    explanation: str
    factors: list[dict[str, Any]]
    created_at: datetime


class RiskHistoryResponse(BaseModel):
    incident_id: uuid.UUID
    latest: RiskResponse | None
    history: list[RiskResponse]


class RiskEvaluateRequest(BaseModel):
    """Stateless what-if evaluation (nothing is stored)."""

    event_severity: Severity
    event_type: str | None = None
    origin_criticality: Criticality | None = None
    dependency_strengths: list[DependencyStrength] = Field(default_factory=list, max_length=500)
    affected_infrastructure_criticalities: list[Criticality] = Field(default_factory=list, max_length=500)
    affected_service_criticalities: list[Criticality] = Field(default_factory=list, max_length=500)


class RiskEvaluateResponse(BaseModel):
    score: int
    level: RiskLevel
    impact_score: int
    likelihood_score: int
    affected_infrastructure_count: int
    affected_services_count: int
    explanation: str
    factors: list[dict[str, Any]]

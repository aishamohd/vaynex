from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from apps.api.schemas.dependency import ImpactNode
from apps.api.schemas.event import EventResponse
from apps.api.schemas.incident import IncidentResponse
from apps.api.schemas.intelligence import AIAnalysisResponse
from apps.api.schemas.recommendation import RecommendationResponse
from packages.common.enums import SimulationScenario


class SimulationRunRequest(BaseModel):
    scenario: SimulationScenario = Field(examples=["hospital_power_failure"])
    apply_status_changes: bool = Field(
        default=True,
        description="Reflect the simulated failure in asset statuses (restored when the incident is resolved)",
    )


class ScenarioInfo(BaseModel):
    key: SimulationScenario
    name: str
    description: str
    event_type: str
    severity: str
    origin: str
    chain: list[str]


class SimulationRisk(BaseModel):
    score: int
    level: str
    impact_score: int
    likelihood_score: int
    explanation: str
    factors: list[dict[str, Any]]


class TimelineStep(BaseModel):
    step: str
    label: str
    detail: str
    at: datetime


class HumanDecision(BaseModel):
    required: bool
    pending_recommendations: int
    message: str


class AuditStatus(BaseModel):
    recorded: bool
    entries: int


class SimulationRunResponse(BaseModel):
    simulation_id: uuid.UUID
    scenario: SimulationScenario
    event: EventResponse
    incident: IncidentResponse | None
    risk: SimulationRisk | None
    affected_infrastructure: list[ImpactNode]
    affected_services: list[ImpactNode]
    ai_analysis: AIAnalysisResponse | None
    recommendations: list[RecommendationResponse]
    human_decision: HumanDecision
    timeline: list[TimelineStep]
    audit: AuditStatus

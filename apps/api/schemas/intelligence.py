from __future__ import annotations

import uuid

from pydantic import BaseModel, Field

from apps.api.schemas.recommendation import RecommendationResponse


class AIActionSchema(BaseModel):
    title: str
    description: str = ""
    priority: str = "MEDIUM"


class AIAnalysisResponse(BaseModel):
    summary: str
    potential_impact: list[str] = Field(default_factory=list)
    affected_services: list[str] = Field(default_factory=list)
    recommended_actions: list[AIActionSchema] = Field(default_factory=list)
    reasoning: str = ""
    confidence: float
    provider: str = "mock"
    model: str | None = None
    advisory_only: bool = True


class AnalyzeIncidentResponse(BaseModel):
    incident_id: uuid.UUID
    ai_analysis: AIAnalysisResponse
    new_recommendations: list[RecommendationResponse]


class ProviderInfoResponse(BaseModel):
    provider: str
    model: str | None
    external: bool = Field(description="True when an external LLM API is used")

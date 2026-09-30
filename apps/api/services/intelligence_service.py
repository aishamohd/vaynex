"""AI intelligence orchestration (provider-agnostic)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.errors import NotFoundError
from apps.api.schemas.intelligence import AIAnalysisResponse, AnalyzeIncidentResponse, ProviderInfoResponse
from apps.api.schemas.recommendation import RecommendationResponse
from apps.api.services.audit_service import AuditService
from apps.api.services.recommendation_service import RecommendationService
from packages.common.enums import AuditAction, ImpactRelationship
from packages.database.models import Event, Incident, RiskAssessment, User
from packages.database.repositories import EventRepository, IncidentRepository, RiskRepository
from packages.intelligence import (
    AIAnalysis,
    AIProvider,
    ContextAsset,
    ContextRisk,
    IncidentContext,
    MockAIProvider,
)

# Payload keys forwarded to the AI; anything else stays private.
_SAFE_PAYLOAD_KEYS = {
    "voltage",
    "duration_minutes",
    "impact_radius_m",
    "rainfall_mm",
    "water_level_m",
    "affected_customers",
    "pressure_bar",
    "packet_loss_pct",
    "cells_down",
    "simulation",
}


def _asset(item: dict[str, Any]) -> ContextAsset:
    return ContextAsset(
        id=str(item["id"]),
        name=item["name"],
        kind=item["kind"],
        type=item["type"],
        criticality=item["criticality"],
        relationship=item["relationship"],
        depth=item["depth"],
        impact_weight=item["impact_weight"],
    )


def build_context(incident: Incident, event: Event, risk: RiskAssessment) -> IncidentContext:
    everything = list(incident.affected_infrastructure) + list(incident.affected_services)
    origin = next((i for i in everything if i["relationship"] == ImpactRelationship.ORIGIN), None)
    return IncidentContext(
        incident_id=str(incident.id),
        title=incident.title,
        description=incident.description or "",
        event_type=str(event.event_type),
        severity=str(event.severity),
        source=event.source,
        origin=_asset(origin) if origin else None,
        affected_infrastructure=[
            _asset(i) for i in incident.affected_infrastructure if i["relationship"] != ImpactRelationship.ORIGIN
        ],
        affected_services=[
            _asset(s) for s in incident.affected_services if s["relationship"] != ImpactRelationship.ORIGIN
        ],
        risk=ContextRisk(score=risk.score, level=str(risk.level), explanation=risk.explanation),
        payload={k: v for k, v in (event.payload or {}).items() if k in _SAFE_PAYLOAD_KEYS},
    )


class IntelligenceService:
    def __init__(self, session: AsyncSession, provider: AIProvider | None = None) -> None:
        self.session = session
        self.provider = provider or MockAIProvider()
        self.incidents = IncidentRepository(session)
        self.events = EventRepository(session)
        self.risks = RiskRepository(session)
        self.audit = AuditService(session)

    def provider_info(self) -> ProviderInfoResponse:
        return ProviderInfoResponse(
            provider=self.provider.name, model=self.provider.model, external=self.provider.name != "mock"
        )

    async def analyze(
        self, incident: Incident, event: Event, risk: RiskAssessment, *, user_id: uuid.UUID | None = None
    ) -> AIAnalysis:
        """Run the provider and stage the result on the incident (caller commits)."""
        analysis = await self.provider.analyze_incident(build_context(incident, event, risk))
        incident.ai_analysis = analysis.model_dump(mode="json")
        self.audit.record(
            AuditAction.AI_ANALYSIS_CREATED,
            "incident",
            incident.id,
            user_id=user_id,
            details={"provider": analysis.provider, "model": analysis.model, "confidence": analysis.confidence},
        )
        return analysis

    async def analyze_incident(self, incident_id: uuid.UUID, user: User) -> AnalyzeIncidentResponse:
        """POST /intelligence/analyze/{id}: re-run analysis and add any new AI recommendations."""
        incident = await self.incidents.get(incident_id)
        if incident is None:
            raise NotFoundError("Incident not found")
        event = await self.events.get(incident.event_id)
        risk = await self.risks.latest_for_incident(incident_id)
        if event is None or risk is None:
            raise NotFoundError("Incident has no event or risk assessment to analyse")
        analysis = await self.analyze(incident, event, risk, user_id=user.id)
        recs = RecommendationService(self.session)
        new_recs = await recs.create_from_ai(incident, analysis, user_id=user.id)
        await self.session.commit()
        return AnalyzeIncidentResponse(
            incident_id=incident.id,
            ai_analysis=AIAnalysisResponse.model_validate(incident.ai_analysis),
            new_recommendations=[RecommendationResponse.model_validate(r) for r in new_recs],
        )

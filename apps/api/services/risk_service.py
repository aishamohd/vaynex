"""Risk assessment: wraps the deterministic engine and persists results."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.errors import NotFoundError
from apps.api.schemas.risk import (
    RiskEvaluateRequest,
    RiskEvaluateResponse,
    RiskHistoryResponse,
    RiskResponse,
)
from apps.api.services.audit_service import AuditService
from packages.common.enums import AuditAction, ImpactRelationship, Severity
from packages.database.models import Event, Incident, RiskAssessment, User
from packages.database.repositories import EventRepository, IncidentRepository, RiskRepository
from packages.risk import RiskEngine, RiskInput, RiskResult


def risk_input_from_impact(
    *,
    event: Event,
    affected_infrastructure: list[dict[str, Any]],
    affected_services: list[dict[str, Any]],
) -> RiskInput:
    """Build engine input from an impact snapshot (origin entries excluded from counts)."""
    origin = next(
        (i for i in affected_infrastructure + affected_services if i["relationship"] == ImpactRelationship.ORIGIN),
        None,
    )
    downstream_infra = [i for i in affected_infrastructure if i["relationship"] != ImpactRelationship.ORIGIN]
    downstream_svc = [s for s in affected_services if s["relationship"] != ImpactRelationship.ORIGIN]
    strengths = [i["dependency_strength"] for i in downstream_infra + downstream_svc if i.get("dependency_strength")]
    # Direct hazard exposure behaves like a HIGH-strength coupling.
    if any(i["relationship"] == ImpactRelationship.DIRECT_EXPOSURE for i in downstream_infra):
        strengths.append("HIGH")
    return RiskInput(
        event_severity=str(event.severity),
        event_type=str(event.event_type),
        origin_criticality=origin["criticality"] if origin else None,
        origin_name=origin["name"] if origin else None,
        dependency_strengths=tuple(strengths),
        affected_infrastructure_criticalities=tuple(i["criticality"] for i in downstream_infra),
        affected_service_criticalities=tuple(s["criticality"] for s in downstream_svc),
        affected_infrastructure_impact=tuple(float(i["impact_weight"]) for i in downstream_infra),
        affected_service_impact=tuple(float(s["impact_weight"]) for s in downstream_svc),
    )


class RiskService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = RiskRepository(session)
        self.incidents = IncidentRepository(session)
        self.events = EventRepository(session)
        self.audit = AuditService(session)
        self.engine = RiskEngine()

    async def assess(
        self, incident: Incident, event: Event, *, user_id: uuid.UUID | None = None
    ) -> tuple[RiskAssessment, RiskResult]:
        """Calculate and stage a risk row for ``incident`` (caller commits)."""
        data = risk_input_from_impact(
            event=event,
            affected_infrastructure=incident.affected_infrastructure,
            affected_services=incident.affected_services,
        )
        result = self.engine.calculate(data)
        risk = await self.repo.create(
            incident_id=incident.id,
            score=result.score,
            level=result.level,
            impact_score=result.impact_score,
            likelihood_score=result.likelihood_score,
            affected_infrastructure_count=len(incident.affected_infrastructure),
            affected_services_count=len(incident.affected_services),
            explanation=result.explanation,
            factors=result.factors_as_dicts(),
        )
        self.audit.record(
            AuditAction.RISK_CALCULATED,
            "risk",
            risk.id,
            user_id=user_id,
            details={
                "incident_id": str(incident.id),
                "score": result.score,
                "level": result.level,
                "engine_version": self.engine.version,
            },
        )
        return risk, result

    async def history(self, incident_id: uuid.UUID) -> RiskHistoryResponse:
        if await self.incidents.get(incident_id) is None:
            raise NotFoundError("Incident not found")
        rows = await self.repo.history_for_incident(incident_id)
        items = [RiskResponse.model_validate(r) for r in rows]
        return RiskHistoryResponse(incident_id=incident_id, latest=items[0] if items else None, history=items)

    async def recalculate(self, incident_id: uuid.UUID, user: User) -> RiskResponse:
        incident = await self.incidents.get(incident_id)
        if incident is None:
            raise NotFoundError("Incident not found")
        event = await self.events.get(incident.event_id)
        if event is None:
            raise NotFoundError("Source event not found")
        risk, _ = await self.assess(incident, event, user_id=user.id)
        incident.severity = Severity(str(risk.level))
        await self.session.commit()
        return RiskResponse.model_validate(risk)

    def evaluate(self, data: RiskEvaluateRequest) -> RiskEvaluateResponse:
        result = self.engine.calculate(
            RiskInput(
                event_severity=data.event_severity.value,
                event_type=data.event_type,
                origin_criticality=data.origin_criticality.value if data.origin_criticality else None,
                dependency_strengths=tuple(s.value for s in data.dependency_strengths),
                affected_infrastructure_criticalities=tuple(
                    c.value for c in data.affected_infrastructure_criticalities
                ),
                affected_service_criticalities=tuple(c.value for c in data.affected_service_criticalities),
            )
        )
        return RiskEvaluateResponse(
            score=result.score,
            level=result.level,
            impact_score=result.impact_score,
            likelihood_score=result.likelihood_score,
            affected_infrastructure_count=result.affected_infrastructure_count,
            affected_services_count=result.affected_services_count,
            explanation=result.explanation,
            factors=result.factors_as_dicts(),
        )

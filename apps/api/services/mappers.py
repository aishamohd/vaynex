"""ORM -> response-schema mapping helpers shared by several services."""

from __future__ import annotations

from typing import Any

from apps.api.schemas.dependency import ImpactNode
from apps.api.schemas.incident import IncidentEventSummary, IncidentResponse, RiskSummary
from apps.api.schemas.intelligence import AIAnalysisResponse
from packages.database.models import Event, Incident, RiskAssessment


def incident_to_response(incident: Incident, risk: RiskAssessment | None) -> IncidentResponse:
    return IncidentResponse(
        id=incident.id,
        event_id=incident.event_id,
        title=incident.title,
        description=incident.description,
        status=incident.status,
        severity=incident.severity,
        detected_at=incident.detected_at,
        resolved_at=incident.resolved_at,
        resolution_note=incident.resolution_note,
        affected_infrastructure_count=len(incident.affected_infrastructure or []),
        affected_services_count=len(incident.affected_services or []),
        risk=RiskSummary(score=risk.score, level=risk.level) if risk else None,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
    )


def event_summary(event: Event | None) -> IncidentEventSummary | None:
    if event is None:
        return None
    return IncidentEventSummary(
        id=event.id,
        event_type=str(event.event_type),
        source=event.source,
        severity=str(event.severity),
        title=event.title,
        description=event.description,
        infrastructure_id=event.infrastructure_id,
        service_id=event.service_id,
        latitude=event.latitude,
        longitude=event.longitude,
        payload=event.payload or {},
        occurred_at=event.occurred_at,
    )


def impact_nodes(items: list[dict[str, Any]] | None) -> list[ImpactNode]:
    return [ImpactNode.model_validate(item) for item in (items or [])]


def ai_analysis_response(data: dict[str, Any] | None) -> AIAnalysisResponse | None:
    return AIAnalysisResponse.model_validate(data) if data else None

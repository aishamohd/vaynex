"""Event ingestion pipeline.

    Event -> Validate -> Store -> Find affected infrastructure -> Analyse dependencies
          -> Find affected services -> Create incident -> Calculate risk
          -> AI analysis -> Recommendations -> Audit

The whole pipeline runs synchronously in a single database transaction so a
failure at any step leaves no partial state behind.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.cache import Cache
from apps.api.core.errors import DomainValidationError, NotFoundError
from apps.api.schemas.common import Page
from apps.api.schemas.event import EventCreate, EventProcessingResult, EventResponse
from apps.api.schemas.intelligence import AIAnalysisResponse
from apps.api.schemas.recommendation import RecommendationResponse
from apps.api.schemas.risk import RiskResponse
from apps.api.services.audit_service import AuditService
from apps.api.services.dependency_service import (
    DependencyService,
    ImpactOrigin,
    split_by_kind,
)
from apps.api.services.incident_service import IncidentService, should_create_incident
from apps.api.services.infrastructure_service import point
from apps.api.services.intelligence_service import IntelligenceService
from apps.api.services.mappers import impact_nodes, incident_to_response
from apps.api.services.recommendation_service import RecommendationService
from apps.api.services.risk_service import RiskService
from packages.common.constants import (
    DASHBOARD_CACHE_KEY,
    DEFAULT_IMPACT_RADIUS_M,
    DIRECT_EXPOSURE_WEIGHT,
    MAX_IMPACT_RADIUS_M,
)
from packages.common.enums import AuditAction, EntityKind, EventType, ImpactRelationship, Severity
from packages.common.utils import utcnow
from packages.database.models import Event, Incident, Recommendation, RiskAssessment, User
from packages.database.repositories import EventRepository, InfrastructureRepository, ServiceRepository
from packages.intelligence import AIAnalysis, AIProvider


@dataclass
class TimelineEntry:
    step: str
    label: str
    detail: str
    at: datetime


@dataclass
class PipelineOutcome:
    event: Event
    incident: Incident | None = None
    risk: RiskAssessment | None = None
    affected_infrastructure: list[dict[str, Any]] = field(default_factory=list)
    affected_services: list[dict[str, Any]] = field(default_factory=list)
    ai_analysis: AIAnalysis | None = None
    recommendations: list[Recommendation] = field(default_factory=list)
    timeline: list[TimelineEntry] = field(default_factory=list)
    audit_entries: int = 0

    def step(self, step: str, label: str, detail: str) -> None:
        self.timeline.append(TimelineEntry(step=step, label=label, detail=detail, at=utcnow()))

    def to_result(self) -> EventProcessingResult:
        return EventProcessingResult(
            event=EventResponse.model_validate(self.event),
            incident_created=self.incident is not None,
            incident=incident_to_response(self.incident, self.risk) if self.incident else None,
            risk=RiskResponse.model_validate(self.risk) if self.risk else None,
            affected_infrastructure=impact_nodes(self.affected_infrastructure),
            affected_services=impact_nodes(self.affected_services),
            ai_analysis=AIAnalysisResponse.model_validate(self.ai_analysis.model_dump(mode="json"))
            if self.ai_analysis
            else None,
            recommendations=[RecommendationResponse.model_validate(r) for r in self.recommendations],
            pipeline=[t.step for t in self.timeline],
        )


class EventService:
    def __init__(self, session: AsyncSession, ai_provider: AIProvider, cache: Cache | None = None) -> None:
        self.session = session
        self.cache = cache
        self.repo = EventRepository(session)
        self.infra = InfrastructureRepository(session)
        self.services = ServiceRepository(session)
        self.audit = AuditService(session)
        self.dependencies = DependencyService(session)
        self.incidents = IncidentService(session)
        self.risk = RiskService(session)
        self.intelligence = IntelligenceService(session, ai_provider)
        self.recommendations = RecommendationService(session)

    # -- queries --------------------------------------------------------------
    async def get(self, event_id: uuid.UUID) -> EventResponse:
        event = await self.repo.get(event_id)
        if event is None:
            raise NotFoundError("Event not found")
        return EventResponse.model_validate(event)

    async def list(
        self,
        *,
        event_type: EventType | None,
        severity: Severity | None,
        infrastructure_id: uuid.UUID | None,
        limit: int,
        offset: int,
    ) -> Page[EventResponse]:
        items, total = await self.repo.list(
            event_type=event_type, severity=severity, infrastructure_id=infrastructure_id, limit=limit, offset=offset
        )
        return Page[EventResponse](
            items=[EventResponse.model_validate(e) for e in items], total=total, limit=limit, offset=offset
        )

    # -- pipeline -------------------------------------------------------------
    async def ingest(self, data: EventCreate, user: User | None) -> EventProcessingResult:
        outcome = await self.process(data, user)
        return outcome.to_result()

    async def process(
        self, data: EventCreate, user: User | None, *, apply_status_changes: bool = True
    ) -> PipelineOutcome:
        user_id = user.id if user else None

        # 1. Validate references
        origin_infra = await self.infra.get(data.infrastructure_id) if data.infrastructure_id else None
        if data.infrastructure_id and origin_infra is None:
            raise DomainValidationError("infrastructure_id does not exist", code="INVALID_REFERENCE")
        origin_service = await self.services.get(data.service_id) if data.service_id else None
        if data.service_id and origin_service is None:
            raise DomainValidationError("service_id does not exist", code="INVALID_REFERENCE")
        radius = float(data.payload.get("impact_radius_m", DEFAULT_IMPACT_RADIUS_M) or 0)
        if radius < 0 or radius > MAX_IMPACT_RADIUS_M:
            raise DomainValidationError(f"payload.impact_radius_m must be between 0 and {MAX_IMPACT_RADIUS_M:.0f}")
        latitude, longitude = data.latitude, data.longitude
        if latitude is None and origin_infra is not None:
            latitude, longitude = origin_infra.latitude, origin_infra.longitude

        # 2. Store
        event = await self.repo.create(
            event_type=data.event_type,
            source=data.source,
            severity=data.severity,
            title=data.title,
            description=data.description,
            infrastructure_id=data.infrastructure_id,
            service_id=data.service_id,
            latitude=latitude,
            longitude=longitude,
            location=point(latitude, longitude),
            payload=data.payload,
            occurred_at=data.occurred_at or utcnow(),
        )
        outcome = PipelineOutcome(event=event)
        self.audit.record(
            AuditAction.EVENT_CREATED,
            "event",
            event.id,
            user_id=user_id,
            details={"event_type": str(event.event_type), "severity": str(event.severity), "source": event.source},
        )
        outcome.step("EVENT_CREATED", "Event received", f"{event.severity} {event.event_type} from {event.source}")

        # 3. Find directly affected infrastructure (origin + PostGIS exposure radius)
        origins: list[ImpactOrigin] = []
        if origin_infra is not None:
            origins.append(ImpactOrigin(key=(EntityKind.INFRASTRUCTURE, origin_infra.id)))
        if origin_service is not None:
            origins.append(ImpactOrigin(key=(EntityKind.SERVICE, origin_service.id)))
        exposed = 0
        if radius > 0 and latitude is not None and longitude is not None:
            for asset, distance in await self.infra.find_within_radius(
                latitude=latitude, longitude=longitude, radius_m=radius
            ):
                if origin_infra is not None and asset.id == origin_infra.id:
                    continue
                exposed += 1
                origins.append(
                    ImpactOrigin(
                        key=(EntityKind.INFRASTRUCTURE, asset.id),
                        weight=DIRECT_EXPOSURE_WEIGHT,
                        relationship=ImpactRelationship.DIRECT_EXPOSURE,
                        distance_m=distance,
                    )
                )
        origin_label = origin_infra.name if origin_infra else origin_service.name if origin_service else "location"
        outcome.step(
            "INFRASTRUCTURE_CONTEXT",
            "Infrastructure context resolved",
            f"Origin: {origin_label}; {exposed} asset(s) within {radius:.0f} m"
            if radius
            else f"Origin: {origin_label}",
        )

        # 4-5. Dependency analysis -> affected infrastructure & services
        impact = await self.dependencies.analyze_impact(origins) if origins else []
        affected_infra, affected_services = split_by_kind(impact)
        outcome.step(
            "DEPENDENCIES_ANALYZED",
            "Dependencies analysed",
            f"{len(affected_infra)} infrastructure asset(s) and {len(affected_services)} service(s) in the impact path",
        )

        # 6. Incident detection
        if not should_create_incident(str(event.severity), impact):
            outcome.affected_infrastructure, outcome.affected_services = affected_infra, affected_services
            outcome.step("NO_INCIDENT", "No incident", "Event below incident threshold; logged for monitoring")
            await self._finish(outcome)
            return outcome

        if apply_status_changes:
            await self.incidents.apply_statuses(impact, str(event.severity))
        incident = await self.incidents.create_from_event(event, affected_infra, affected_services, user_id=user_id)
        outcome.incident = incident
        outcome.affected_infrastructure, outcome.affected_services = affected_infra, affected_services
        outcome.step("INCIDENT_DETECTED", "Incident detected", incident.title)

        # 7. Risk
        risk, result = await self.risk.assess(incident, event, user_id=user_id)
        incident.severity = Severity(result.level)
        outcome.risk = risk
        outcome.step("RISK_ASSESSED", "Risk calculated", f"{result.level} ({result.score}/100)")

        # 8. AI analysis
        analysis = await self.intelligence.analyze(incident, event, risk, user_id=user_id)
        outcome.ai_analysis = analysis
        outcome.step(
            "AI_ANALYSIS",
            "AI analysis completed",
            f"Provider {analysis.provider}, confidence {analysis.confidence:.2f}",
        )

        # 9. Recommendations (rule engine first, then AI - de-duplicated)
        recs = await self.recommendations.create_from_rules(incident, event, result.level, user_id=user_id)
        recs += await self.recommendations.create_from_ai(incident, analysis, user_id=user_id)
        outcome.recommendations = sorted(
            recs,
            key=lambda r: (
                {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}[str(r.priority)],
                r.source != "RULE_ENGINE",
            ),
        )
        outcome.step(
            "RECOMMENDATIONS",
            "Recommendations generated",
            f"{len(recs)} recommendation(s) awaiting operator decision",
        )
        await self._finish(outcome)
        return outcome

    async def _finish(self, outcome: PipelineOutcome) -> None:
        await self.session.flush()
        outcome.audit_entries = sum(
            len(svc.audit.recorded)
            for svc in (self, self.incidents, self.risk, self.intelligence, self.recommendations)
        )
        outcome.step("AUDIT", "Audit recorded", f"{outcome.audit_entries} audit entr(ies) written")
        await self.session.commit()
        if self.cache:
            await self.cache.delete(DASHBOARD_CACHE_KEY)

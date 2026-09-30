"""Recommendations from the rule engine and AI, plus operator decisions."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.cache import Cache
from apps.api.core.errors import ConflictError, NotFoundError
from apps.api.schemas.common import Page
from apps.api.schemas.recommendation import RecommendationResponse, RecommendationUpdate
from apps.api.services.audit_service import AuditService
from packages.common.constants import DASHBOARD_CACHE_KEY
from packages.common.enums import (
    AuditAction,
    IncidentStatus,
    RecommendationPriority,
    RecommendationSource,
    RecommendationStatus,
)
from packages.common.utils import utcnow
from packages.database.models import Event, Incident, Recommendation, User
from packages.database.repositories import IncidentRepository, RecommendationRepository
from packages.intelligence import AIAnalysis
from packages.risk import match_recommendation_rules

ALLOWED_TRANSITIONS: dict[RecommendationStatus, set[RecommendationStatus]] = {
    RecommendationStatus.PENDING: {RecommendationStatus.ACCEPTED, RecommendationStatus.REJECTED},
    RecommendationStatus.ACCEPTED: {RecommendationStatus.COMPLETED},
    RecommendationStatus.REJECTED: set(),
    RecommendationStatus.COMPLETED: set(),
}

_DECISION_AUDIT = {
    RecommendationStatus.ACCEPTED: AuditAction.RECOMMENDATION_ACCEPTED,
    RecommendationStatus.REJECTED: AuditAction.RECOMMENDATION_REJECTED,
    RecommendationStatus.COMPLETED: AuditAction.RECOMMENDATION_COMPLETED,
}


def _norm(title: str) -> str:
    return " ".join(title.lower().split())


class RecommendationService:
    def __init__(self, session: AsyncSession, cache: Cache | None = None) -> None:
        self.session = session
        self.cache = cache
        self.repo = RecommendationRepository(session)
        self.incidents = IncidentRepository(session)
        self.audit = AuditService(session)

    async def _existing_titles(self, incident_id: uuid.UUID) -> set[str]:
        return {_norm(r.title) for r in await self.repo.for_incident(incident_id)}

    async def _stage(
        self,
        incident: Incident,
        *,
        title: str,
        description: str,
        priority: str,
        source: RecommendationSource,
        rule_key: str | None,
        seen: set[str],
        user_id: uuid.UUID | None,
    ) -> Recommendation | None:
        key = _norm(title)
        if key in seen:
            return None
        seen.add(key)
        rec = await self.repo.create(
            incident_id=incident.id,
            title=title[:200],
            description=description,
            priority=RecommendationPriority(priority),
            source=source,
            status=RecommendationStatus.PENDING,
            rule_key=rule_key,
        )
        self.audit.record(
            AuditAction.RECOMMENDATION_CREATED,
            "recommendation",
            rec.id,
            user_id=user_id,
            details={"incident_id": str(incident.id), "source": source.value, "priority": priority, "title": rec.title},
        )
        return rec

    async def create_from_rules(
        self, incident: Incident, event: Event, risk_level: str, *, user_id: uuid.UUID | None = None
    ) -> list[Recommendation]:
        rules = match_recommendation_rules(
            event_type=str(event.event_type),
            risk_level=risk_level,
            affected_infrastructure_types=[i["type"] for i in incident.affected_infrastructure],
            affected_service_types=[s["type"] for s in incident.affected_services],
        )
        seen = await self._existing_titles(incident.id)
        created: list[Recommendation] = []
        for rule in rules:
            rec = await self._stage(
                incident,
                title=rule.title,
                description=rule.description,
                priority=rule.priority,
                source=RecommendationSource.RULE_ENGINE,
                rule_key=rule.key,
                seen=seen,
                user_id=user_id,
            )
            if rec:
                created.append(rec)
        return created

    async def create_from_ai(
        self, incident: Incident, analysis: AIAnalysis, *, user_id: uuid.UUID | None = None
    ) -> list[Recommendation]:
        seen = await self._existing_titles(incident.id)
        created: list[Recommendation] = []
        for action in analysis.recommended_actions:
            rec = await self._stage(
                incident,
                title=action.title,
                description=action.description,
                priority=action.priority,
                source=RecommendationSource.AI,
                rule_key=None,
                seen=seen,
                user_id=user_id,
            )
            if rec:
                created.append(rec)
        return created

    async def list(
        self,
        *,
        incident_id: uuid.UUID | None,
        status: RecommendationStatus | None,
        source: RecommendationSource | None,
        priority: RecommendationPriority | None,
        limit: int,
        offset: int,
    ) -> Page[RecommendationResponse]:
        items, total = await self.repo.list(
            incident_id=incident_id, status=status, source=source, priority=priority, limit=limit, offset=offset
        )
        return Page[RecommendationResponse](
            items=[RecommendationResponse.model_validate(r) for r in items], total=total, limit=limit, offset=offset
        )

    async def get(self, rec_id: uuid.UUID) -> RecommendationResponse:
        rec = await self.repo.get(rec_id)
        if rec is None:
            raise NotFoundError("Recommendation not found")
        return RecommendationResponse.model_validate(rec)

    async def decide(self, rec_id: uuid.UUID, data: RecommendationUpdate, user: User) -> RecommendationResponse:
        """Record a human operator decision (the only way a recommendation changes state)."""
        rec = await self.repo.get(rec_id)
        if rec is None:
            raise NotFoundError("Recommendation not found")
        new_status = RecommendationStatus(data.status)
        current = RecommendationStatus(rec.status)
        if new_status not in ALLOWED_TRANSITIONS[current]:
            raise ConflictError(
                f"Cannot change recommendation from {current.value} to {new_status.value}",
                code="INVALID_STATE_TRANSITION",
            )
        rec.status = new_status
        rec.decided_by = user.id
        rec.decided_at = utcnow()
        if data.note is not None:
            rec.decision_note = data.note

        incident = await self.incidents.get(rec.incident_id)
        if (
            incident is not None
            and new_status == RecommendationStatus.ACCEPTED
            and incident.status in (IncidentStatus.OPEN, IncidentStatus.INVESTIGATING)
        ):
            previous = str(incident.status)
            incident.status = IncidentStatus.MITIGATING
            self.audit.record(
                AuditAction.INCIDENT_UPDATED,
                "incident",
                incident.id,
                user_id=user.id,
                details={
                    "status": {"from": previous, "to": IncidentStatus.MITIGATING.value},
                    "reason": "recommendation_accepted",
                },
            )

        self.audit.record(
            _DECISION_AUDIT[new_status],
            "recommendation",
            rec.id,
            user_id=user.id,
            details={
                "incident_id": str(rec.incident_id),
                "from": current.value,
                "to": new_status.value,
                "title": rec.title,
                "note": data.note,
            },
        )
        await self.session.flush()
        await self.session.commit()
        if self.cache:
            await self.cache.delete(DASHBOARD_CACHE_KEY)
        return RecommendationResponse.model_validate(rec)

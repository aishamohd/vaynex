"""Incident detection, lifecycle and asset-status reflection."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.cache import Cache
from apps.api.core.errors import ConflictError, NotFoundError
from apps.api.schemas.common import Page
from apps.api.schemas.incident import (
    IncidentDetailResponse,
    IncidentResolveRequest,
    IncidentResponse,
    IncidentUpdate,
)
from apps.api.schemas.recommendation import RecommendationResponse
from apps.api.schemas.risk import RiskResponse
from apps.api.services.audit_service import AuditService
from apps.api.services.mappers import ai_analysis_response, event_summary, impact_nodes, incident_to_response
from packages.common.constants import DASHBOARD_CACHE_KEY, LEVEL_ORDER
from packages.common.enums import (
    AuditAction,
    EntityKind,
    ImpactRelationship,
    IncidentStatus,
    InfrastructureStatus,
    ServiceStatus,
    Severity,
)
from packages.common.utils import utcnow
from packages.database.models import Event, Incident, User
from packages.database.repositories import (
    EventRepository,
    IncidentRepository,
    InfrastructureRepository,
    RecommendationRepository,
    RiskRepository,
    ServiceRepository,
)

_INFRA_BADNESS = {"OPERATIONAL": 0, "MAINTENANCE": 1, "DEGRADED": 2, "FAILED": 3}
_SERVICE_BADNESS = {"OPERATIONAL": 0, "DEGRADED": 1, "SUSPENDED": 2, "DISRUPTED": 3}


def should_create_incident(severity: str, impact: list[dict[str, Any]]) -> bool:
    """Incident detection rule.

    An incident is opened when the event is at least MEDIUM severity, or the
    origin is HIGH/CRITICAL criticality, or any CRITICAL asset/service is
    affected. LOW-severity noise on low-criticality assets is only logged.
    """
    if LEVEL_ORDER.get(str(severity), 0) >= LEVEL_ORDER["MEDIUM"]:
        return True
    for item in impact:
        if item["relationship"] == ImpactRelationship.ORIGIN and LEVEL_ORDER.get(item["criticality"], 0) >= 2:
            return True
        if item["criticality"] == "CRITICAL":
            return True
    return False


def target_status(item: dict[str, Any], severity: str) -> str | None:
    """Status an affected node should reflect, or None to leave unchanged."""
    severe = LEVEL_ORDER.get(str(severity), 0) >= LEVEL_ORDER["HIGH"]
    rel, weight = item["relationship"], float(item["impact_weight"])
    if item["kind"] == EntityKind.INFRASTRUCTURE:
        if rel == ImpactRelationship.ORIGIN:
            return InfrastructureStatus.FAILED.value if severe else InfrastructureStatus.DEGRADED.value
        if rel == ImpactRelationship.DIRECT_EXPOSURE or weight >= 0.5:
            return InfrastructureStatus.DEGRADED.value
        return None
    if rel == ImpactRelationship.ORIGIN or weight >= 0.75:
        return ServiceStatus.DISRUPTED.value if severe else ServiceStatus.DEGRADED.value
    if weight >= 0.5:
        return ServiceStatus.DEGRADED.value
    return None


class IncidentService:
    def __init__(self, session: AsyncSession, cache: Cache | None = None) -> None:
        self.session = session
        self.cache = cache
        self.repo = IncidentRepository(session)
        self.events = EventRepository(session)
        self.risks = RiskRepository(session)
        self.recs = RecommendationRepository(session)
        self.infra = InfrastructureRepository(session)
        self.services = ServiceRepository(session)
        self.audit = AuditService(session)

    # -- detection --------------------------------------------------------------
    async def create_from_event(
        self,
        event: Event,
        affected_infrastructure: list[dict[str, Any]],
        affected_services: list[dict[str, Any]],
        *,
        user_id: uuid.UUID | None = None,
    ) -> Incident:
        downstream = [
            i for i in affected_infrastructure + affected_services if i["relationship"] != ImpactRelationship.ORIGIN
        ]
        critical = sorted({i["name"] for i in downstream if i["criticality"] == "CRITICAL"})
        description = (
            f"Detected from a {event.severity} {event.event_type} event reported by '{event.source}'. "
            f"{len(affected_infrastructure)} infrastructure asset(s) and {len(affected_services)} public "
            f"service(s) affected."
        )
        if critical:
            description += f" Critical dependents: {', '.join(critical)}."
        incident = await self.repo.create(
            event_id=event.id,
            title=event.title,
            description=description,
            status=IncidentStatus.OPEN,
            severity=event.severity,
            detected_at=utcnow(),
            affected_infrastructure=affected_infrastructure,
            affected_services=affected_services,
        )
        self.audit.record(
            AuditAction.INCIDENT_CREATED,
            "incident",
            incident.id,
            user_id=user_id,
            details={
                "event_id": str(event.id),
                "severity": str(event.severity),
                "affected_infrastructure": len(affected_infrastructure),
                "affected_services": len(affected_services),
            },
        )
        return incident

    async def apply_statuses(self, items: list[dict[str, Any]], severity: str) -> None:
        """Reflect observed impact on asset/service statuses (never 'improves' a status).

        Each item's ``status`` becomes the applied status and ``previous_status``
        keeps the original so it can be restored when the incident resolves.
        """
        for item in items:
            desired = target_status(item, severity)
            node_id = uuid.UUID(str(item["id"]))
            if item["kind"] == EntityKind.INFRASTRUCTURE:
                node = await self.infra.get(node_id)
                badness = _INFRA_BADNESS
                enum_cls: Any = InfrastructureStatus
            else:
                node = await self.services.get(node_id)
                badness = _SERVICE_BADNESS
                enum_cls = ServiceStatus
            if node is None:
                continue
            current = str(node.status)
            item["previous_status"] = current
            if desired and badness.get(desired, 0) > badness.get(current, 0):
                node.status = enum_cls(desired)
                item["status"] = desired
            else:
                item["status"] = current

    async def _restore_statuses(self, incident: Incident) -> int:
        """Restore statuses changed by this incident unless another active incident still holds them."""
        other_active: set[str] = set()
        for other_id in await self.repo.active_ids():
            if other_id == incident.id:
                continue
            other = await self.repo.get(other_id)
            if other:
                other_active |= {str(i["id"]) for i in other.affected_infrastructure + other.affected_services}
        restored = 0
        for item in list(incident.affected_infrastructure) + list(incident.affected_services):
            prev, applied = item.get("previous_status"), item.get("status")
            if not prev or prev == applied or str(item["id"]) in other_active:
                continue
            node_id = uuid.UUID(str(item["id"]))
            if item["kind"] == EntityKind.INFRASTRUCTURE:
                node = await self.infra.get(node_id)
                enum_cls: Any = InfrastructureStatus
            else:
                node = await self.services.get(node_id)
                enum_cls = ServiceStatus
            if node is not None and str(node.status) == applied:
                node.status = enum_cls(prev)
                restored += 1
        return restored

    # -- queries ----------------------------------------------------------------
    async def _get_or_404(self, incident_id: uuid.UUID) -> Incident:
        incident = await self.repo.get(incident_id)
        if incident is None:
            raise NotFoundError("Incident not found")
        return incident

    async def list(
        self,
        *,
        status: IncidentStatus | None,
        severity: Severity | None,
        active_only: bool,
        limit: int,
        offset: int,
    ) -> Page[IncidentResponse]:
        items, total = await self.repo.list(
            status=status, severity=severity, active_only=active_only, limit=limit, offset=offset
        )
        risks = await self.risks.latest_for_incidents([i.id for i in items])
        return Page[IncidentResponse](
            items=[incident_to_response(i, risks.get(i.id)) for i in items], total=total, limit=limit, offset=offset
        )

    async def detail(self, incident_id: uuid.UUID) -> IncidentDetailResponse:
        incident = await self._get_or_404(incident_id)
        event = await self.events.get(incident.event_id)
        risk = await self.risks.latest_for_incident(incident.id)
        recs = await self.recs.for_incident(incident.id)
        base = incident_to_response(incident, risk)
        return IncidentDetailResponse(
            **base.model_dump(),
            event=event_summary(event),
            affected_infrastructure=impact_nodes(incident.affected_infrastructure),
            affected_services=impact_nodes(incident.affected_services),
            risk_assessment=RiskResponse.model_validate(risk) if risk else None,
            recommendations=[RecommendationResponse.model_validate(r) for r in recs],
            ai_analysis=ai_analysis_response(incident.ai_analysis),
        )

    # -- lifecycle ----------------------------------------------------------------
    async def update(self, incident_id: uuid.UUID, data: IncidentUpdate, user: User) -> IncidentDetailResponse:
        incident = await self._get_or_404(incident_id)
        if incident.status == IncidentStatus.RESOLVED:
            raise ConflictError("Resolved incidents cannot be modified", code="INCIDENT_RESOLVED")
        changes = data.model_dump(exclude_unset=True, exclude_none=True)
        audit_changes: dict[str, Any] = {}
        for field_name, value in changes.items():
            old = getattr(incident, field_name)
            new = IncidentStatus(value) if field_name == "status" else value
            if old != new:
                audit_changes[field_name] = {"from": str(old), "to": str(new)} if field_name == "status" else True
                setattr(incident, field_name, new)
        if audit_changes:
            self.audit.record(
                AuditAction.INCIDENT_UPDATED,
                "incident",
                incident.id,
                user_id=user.id,
                details={"changes": audit_changes},
            )
            await self.session.flush()
            await self.session.commit()
            await self._invalidate()
        return await self.detail(incident_id)

    async def resolve(self, incident_id: uuid.UUID, data: IncidentResolveRequest, user: User) -> IncidentDetailResponse:
        incident = await self._get_or_404(incident_id)
        if incident.status == IncidentStatus.RESOLVED:
            raise ConflictError("Incident is already resolved", code="INCIDENT_ALREADY_RESOLVED")
        restored = await self._restore_statuses(incident) if data.restore_asset_status else 0
        incident.status = IncidentStatus.RESOLVED
        incident.resolved_at = utcnow()
        incident.resolution_note = data.resolution_note
        self.audit.record(
            AuditAction.INCIDENT_RESOLVED,
            "incident",
            incident.id,
            user_id=user.id,
            details={"restored_assets": restored, "note": data.resolution_note},
        )
        await self.session.flush()
        await self.session.commit()
        await self._invalidate()
        return await self.detail(incident_id)

    async def _invalidate(self) -> None:
        if self.cache:
            await self.cache.delete(DASHBOARD_CACHE_KEY)

"""Dashboard overview (cached briefly in Redis; works without Redis)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.cache import Cache
from apps.api.schemas.dashboard import DashboardEvent, DashboardInfrastructure, DashboardOverview
from apps.api.services.mappers import incident_to_response
from packages.common.constants import DASHBOARD_CACHE_KEY
from packages.common.enums import RecommendationStatus, Severity
from packages.common.utils import utcnow
from packages.database.repositories import (
    EventRepository,
    IncidentRepository,
    InfrastructureRepository,
    RecommendationRepository,
    RiskRepository,
    ServiceRepository,
)


class DashboardService:
    def __init__(self, session: AsyncSession, cache: Cache | None = None, ttl_seconds: int = 15) -> None:
        self.session = session
        self.cache = cache
        self.ttl = ttl_seconds
        self.infra = InfrastructureRepository(session)
        self.services = ServiceRepository(session)
        self.incidents = IncidentRepository(session)
        self.events = EventRepository(session)
        self.risks = RiskRepository(session)

    async def overview(self) -> DashboardOverview:
        if self.cache:
            cached = await self.cache.get_json(DASHBOARD_CACHE_KEY)
            if cached:
                return DashboardOverview.model_validate({**cached, "cached": True})

        overview = await self._compute()
        if self.cache:
            await self.cache.set_json(DASHBOARD_CACHE_KEY, overview.model_dump(mode="json"), self.ttl)
        return overview

    async def _compute(self) -> DashboardOverview:
        infra_status = await self.infra.count_by_status()
        svc_status = await self.services.count_by_status()
        active_ids = await self.incidents.active_ids()
        avg = await self.risks.average_score(active_ids)
        pending = await RecommendationRepository(self.session).count_by_status(RecommendationStatus.PENDING)
        recent_incidents = await self.incidents.recent(5)
        recent_risks = await self.risks.latest_for_incidents([i.id for i in recent_incidents])
        return DashboardOverview(
            total_infrastructure=sum(infra_status.values()),
            operational_infrastructure=infra_status.get("OPERATIONAL", 0),
            degraded_infrastructure=infra_status.get("DEGRADED", 0),
            failed_infrastructure=infra_status.get("FAILED", 0),
            maintenance_infrastructure=infra_status.get("MAINTENANCE", 0),
            total_services=sum(svc_status.values()),
            disrupted_services=svc_status.get("DISRUPTED", 0) + svc_status.get("DEGRADED", 0),
            active_incidents=len(active_ids),
            critical_incidents=await self.incidents.count_active(severity=Severity.CRITICAL),
            average_risk=round(avg, 1) if avg is not None else 0.0,
            pending_recommendations=pending,
            recent_events=[
                DashboardEvent(
                    id=e.id,
                    event_type=str(e.event_type),
                    severity=str(e.severity),
                    title=e.title,
                    source=e.source,
                    occurred_at=e.occurred_at,
                )
                for e in await self.events.recent(5)
            ],
            recent_incidents=[incident_to_response(i, recent_risks.get(i.id)) for i in recent_incidents],
            critical_infrastructure=[
                DashboardInfrastructure(
                    id=i.id,
                    name=i.name,
                    infrastructure_type=str(i.infrastructure_type),
                    status=str(i.status),
                    criticality=str(i.criticality),
                    latitude=i.latitude,
                    longitude=i.longitude,
                )
                for i in await self.infra.list_critical(10)
            ],
            generated_at=utcnow(),
            cached=False,
        )

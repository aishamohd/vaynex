from __future__ import annotations

import uuid

from geoalchemy2 import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.cache import Cache
from apps.api.core.errors import DomainValidationError, NotFoundError
from apps.api.schemas.common import Page
from apps.api.schemas.dependency import InfrastructureDependenciesResponse
from apps.api.schemas.infrastructure import (
    InfrastructureCreate,
    InfrastructureResponse,
    InfrastructureUpdate,
)
from apps.api.services.audit_service import AuditService
from apps.api.services.dependency_service import DependencyService
from packages.common.constants import DASHBOARD_CACHE_KEY
from packages.common.enums import AuditAction, Criticality, InfrastructureStatus, InfrastructureType
from packages.database.models import Infrastructure, User
from packages.database.repositories import InfrastructureRepository, OrganizationRepository


def point(latitude: float | None, longitude: float | None) -> WKTElement | None:
    """PostGIS POINT (x=longitude, y=latitude) in SRID 4326."""
    if latitude is None or longitude is None:
        return None
    return WKTElement(f"POINT({longitude} {latitude})", srid=4326)


class InfrastructureService:
    def __init__(self, session: AsyncSession, cache: Cache | None = None) -> None:
        self.session = session
        self.cache = cache
        self.repo = InfrastructureRepository(session)
        self.orgs = OrganizationRepository(session)
        self.audit = AuditService(session)

    async def _invalidate(self) -> None:
        if self.cache:
            await self.cache.delete(DASHBOARD_CACHE_KEY)

    async def _get_or_404(self, infra_id: uuid.UUID) -> Infrastructure:
        infra = await self.repo.get(infra_id)
        if infra is None:
            raise NotFoundError("Infrastructure not found")
        return infra

    async def create(self, data: InfrastructureCreate, user: User) -> InfrastructureResponse:
        if await self.orgs.get(data.organization_id) is None:
            raise DomainValidationError("Organization does not exist", code="INVALID_REFERENCE")
        values = data.model_dump(exclude={"metadata"})
        infra = await self.repo.create(**values, meta=data.metadata, location=point(data.latitude, data.longitude))
        self.audit.record(
            AuditAction.INFRASTRUCTURE_CREATED,
            "infrastructure",
            infra.id,
            user_id=user.id,
            details={"name": infra.name, "type": str(infra.infrastructure_type)},
        )
        await self.session.commit()
        await self._invalidate()
        return InfrastructureResponse.model_validate(infra)

    async def get(self, infra_id: uuid.UUID) -> InfrastructureResponse:
        return InfrastructureResponse.model_validate(await self._get_or_404(infra_id))

    async def list(
        self,
        *,
        organization_id: uuid.UUID | None,
        infrastructure_type: InfrastructureType | None,
        status: InfrastructureStatus | None,
        criticality: Criticality | None,
        search: str | None,
        limit: int,
        offset: int,
    ) -> Page[InfrastructureResponse]:
        items, total = await self.repo.list(
            organization_id=organization_id,
            infrastructure_type=infrastructure_type,
            status=status,
            criticality=criticality,
            search=search,
            limit=limit,
            offset=offset,
        )
        return Page[InfrastructureResponse](
            items=[InfrastructureResponse.model_validate(i) for i in items], total=total, limit=limit, offset=offset
        )

    async def update(self, infra_id: uuid.UUID, data: InfrastructureUpdate, user: User) -> InfrastructureResponse:
        infra = await self._get_or_404(infra_id)
        changes = data.model_dump(exclude_unset=True)
        if "metadata" in changes:
            meta = changes.pop("metadata")
            infra.meta = meta or {}
        for field_name, value in changes.items():
            if field_name in {"name", "infrastructure_type", "status", "criticality"} and value is None:
                continue  # explicit nulls are ignored for required columns
            setattr(infra, field_name, value)
        if "latitude" in changes or "longitude" in changes:
            infra.location = point(infra.latitude, infra.longitude)
        self.audit.record(
            AuditAction.INFRASTRUCTURE_UPDATED,
            "infrastructure",
            infra.id,
            user_id=user.id,
            details={"fields": sorted(data.model_dump(exclude_unset=True).keys())},
        )
        await self.session.flush()
        await self.session.commit()
        await self._invalidate()
        return InfrastructureResponse.model_validate(infra)

    async def delete(self, infra_id: uuid.UUID, user: User) -> None:
        infra = await self._get_or_404(infra_id)
        name = infra.name
        await self.repo.delete(infra)
        self.audit.record(
            AuditAction.INFRASTRUCTURE_DELETED, "infrastructure", infra_id, user_id=user.id, details={"name": name}
        )
        await self.session.commit()
        await self._invalidate()

    async def dependencies(self, infra_id: uuid.UUID) -> InfrastructureDependenciesResponse:
        return await DependencyService(self.session).for_infrastructure(infra_id)

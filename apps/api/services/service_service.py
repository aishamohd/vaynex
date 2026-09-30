"""Public services (e.g. Emergency Healthcare). Named to mirror the module layout."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.cache import Cache
from apps.api.core.errors import DomainValidationError, NotFoundError
from apps.api.schemas.common import Page
from apps.api.schemas.service import ServiceCreate, ServiceResponse, ServiceUpdate
from apps.api.services.audit_service import AuditService
from packages.common.constants import DASHBOARD_CACHE_KEY
from packages.common.enums import AuditAction, Criticality, ServiceStatus, ServiceType
from packages.database.models import PublicService, User
from packages.database.repositories import (
    InfrastructureRepository,
    OrganizationRepository,
    ServiceRepository,
)


class PublicServiceService:
    def __init__(self, session: AsyncSession, cache: Cache | None = None) -> None:
        self.session = session
        self.cache = cache
        self.repo = ServiceRepository(session)
        self.orgs = OrganizationRepository(session)
        self.infra = InfrastructureRepository(session)
        self.audit = AuditService(session)

    async def _invalidate(self) -> None:
        if self.cache:
            await self.cache.delete(DASHBOARD_CACHE_KEY)

    async def _get_or_404(self, service_id: uuid.UUID) -> PublicService:
        svc = await self.repo.get(service_id)
        if svc is None:
            raise NotFoundError("Service not found")
        return svc

    async def _check_infra(self, infra_id: uuid.UUID | None) -> None:
        if infra_id is not None and await self.infra.get(infra_id) is None:
            raise DomainValidationError("Infrastructure does not exist", code="INVALID_REFERENCE")

    async def create(self, data: ServiceCreate, user: User) -> ServiceResponse:
        if await self.orgs.get(data.organization_id) is None:
            raise DomainValidationError("Organization does not exist", code="INVALID_REFERENCE")
        await self._check_infra(data.infrastructure_id)
        svc = await self.repo.create(**data.model_dump())
        self.audit.record(
            AuditAction.SERVICE_CREATED,
            "service",
            svc.id,
            user_id=user.id,
            details={"name": svc.name, "type": str(svc.service_type)},
        )
        await self.session.commit()
        await self._invalidate()
        return ServiceResponse.model_validate(svc)

    async def get(self, service_id: uuid.UUID) -> ServiceResponse:
        return ServiceResponse.model_validate(await self._get_or_404(service_id))

    async def list(
        self,
        *,
        organization_id: uuid.UUID | None,
        service_type: ServiceType | None,
        status: ServiceStatus | None,
        criticality: Criticality | None,
        infrastructure_id: uuid.UUID | None,
        limit: int,
        offset: int,
    ) -> Page[ServiceResponse]:
        items, total = await self.repo.list(
            organization_id=organization_id,
            service_type=service_type,
            status=status,
            criticality=criticality,
            infrastructure_id=infrastructure_id,
            limit=limit,
            offset=offset,
        )
        return Page[ServiceResponse](
            items=[ServiceResponse.model_validate(s) for s in items], total=total, limit=limit, offset=offset
        )

    async def update(self, service_id: uuid.UUID, data: ServiceUpdate, user: User) -> ServiceResponse:
        svc = await self._get_or_404(service_id)
        changes = data.model_dump(exclude_unset=True)
        if "infrastructure_id" in changes:
            await self._check_infra(changes["infrastructure_id"])
        for field_name, value in changes.items():
            if field_name in {"name", "service_type", "status", "criticality"} and value is None:
                continue
            setattr(svc, field_name, value)
        self.audit.record(
            AuditAction.SERVICE_UPDATED, "service", svc.id, user_id=user.id, details={"fields": sorted(changes.keys())}
        )
        await self.session.flush()
        await self.session.commit()
        await self._invalidate()
        return ServiceResponse.model_validate(svc)

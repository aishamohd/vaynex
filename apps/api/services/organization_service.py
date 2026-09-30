from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.errors import ConflictError, NotFoundError
from apps.api.schemas.common import Page
from apps.api.schemas.organization import OrganizationCreate, OrganizationResponse
from apps.api.services.audit_service import AuditService
from packages.common.enums import AuditAction
from packages.database.models import User
from packages.database.repositories import OrganizationRepository


class OrganizationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = OrganizationRepository(session)
        self.audit = AuditService(session)

    async def create(self, data: OrganizationCreate, user: User) -> OrganizationResponse:
        if await self.repo.get_by_name(data.name):
            raise ConflictError(f"Organization '{data.name}' already exists")
        org = await self.repo.create(**data.model_dump())
        self.audit.record(
            AuditAction.ORGANIZATION_CREATED, "organization", org.id, user_id=user.id, details={"name": org.name}
        )
        await self.session.commit()
        return OrganizationResponse.model_validate(org)

    async def list(self, *, limit: int, offset: int) -> Page[OrganizationResponse]:
        items, total = await self.repo.list(limit=limit, offset=offset)
        return Page[OrganizationResponse](
            items=[OrganizationResponse.model_validate(o) for o in items], total=total, limit=limit, offset=offset
        )

    async def get(self, org_id: uuid.UUID) -> OrganizationResponse:
        org = await self.repo.get(org_id)
        if org is None:
            raise NotFoundError("Organization not found")
        return OrganizationResponse.model_validate(org)

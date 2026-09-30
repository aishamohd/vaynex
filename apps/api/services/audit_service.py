"""Append-only audit trail."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.schemas.audit import AuditLogResponse
from apps.api.schemas.common import Page
from packages.common.enums import AuditAction
from packages.database.models import AuditLog
from packages.database.repositories import AuditRepository


class AuditService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = AuditRepository(session)
        self.recorded: list[AuditLog] = []

    def record(
        self,
        action: AuditAction | str,
        entity_type: str,
        entity_id: uuid.UUID | None = None,
        *,
        user_id: uuid.UUID | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditLog:
        """Stage an audit entry in the current unit of work (committed with it)."""
        entry = AuditLog(
            id=uuid.uuid4(),
            action=str(action),
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            details=details or {},
        )
        self.repo.add(entry)
        self.recorded.append(entry)
        return entry

    async def list(
        self,
        *,
        action: str | None,
        entity_type: str | None,
        entity_id: uuid.UUID | None,
        user_id: uuid.UUID | None,
        limit: int,
        offset: int,
    ) -> Page[AuditLogResponse]:
        items, total = await self.repo.list(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            limit=limit,
            offset=offset,
        )
        return Page[AuditLogResponse](
            items=[AuditLogResponse.model_validate(i) for i in items], total=total, limit=limit, offset=offset
        )

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from apps.api.schemas.common import ORMModel


class AuditLogResponse(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    entity_type: str
    entity_id: uuid.UUID | None
    details: dict[str, Any]
    created_at: datetime

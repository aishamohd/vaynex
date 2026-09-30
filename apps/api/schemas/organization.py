from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from apps.api.schemas.common import ORMModel
from packages.common.enums import OrganizationType


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    organization_type: OrganizationType
    description: str | None = Field(default=None, max_length=5000)


class OrganizationResponse(ORMModel):
    id: uuid.UUID
    name: str
    organization_type: OrganizationType
    description: str | None
    created_at: datetime
    updated_at: datetime

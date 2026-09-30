from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from apps.api.schemas.common import ORMModel
from packages.common.enums import Criticality, ServiceStatus, ServiceType


class ServiceCreate(BaseModel):
    organization_id: uuid.UUID
    name: str = Field(min_length=2, max_length=200)
    service_type: ServiceType
    status: ServiceStatus = ServiceStatus.OPERATIONAL
    criticality: Criticality = Criticality.MEDIUM
    description: str | None = Field(default=None, max_length=5000)
    infrastructure_id: uuid.UUID | None = None


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    service_type: ServiceType | None = None
    status: ServiceStatus | None = None
    criticality: Criticality | None = None
    description: str | None = Field(default=None, max_length=5000)
    infrastructure_id: uuid.UUID | None = None


class ServiceResponse(ORMModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    service_type: ServiceType
    status: ServiceStatus
    criticality: Criticality
    description: str | None
    infrastructure_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

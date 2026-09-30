from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import AliasChoices, BaseModel, Field, model_validator

from apps.api.schemas.common import ORMModel
from packages.common.enums import Criticality, InfrastructureStatus, InfrastructureType


class _Coordinates(BaseModel):
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def _both_or_neither(self) -> Any:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        return self


class InfrastructureCreate(_Coordinates):
    organization_id: uuid.UUID
    name: str = Field(min_length=2, max_length=200)
    infrastructure_type: InfrastructureType
    status: InfrastructureStatus = InfrastructureStatus.OPERATIONAL
    criticality: Criticality = Criticality.MEDIUM
    description: str | None = Field(default=None, max_length=5000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class InfrastructureUpdate(_Coordinates):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    infrastructure_type: InfrastructureType | None = None
    status: InfrastructureStatus | None = None
    criticality: Criticality | None = None
    description: str | None = Field(default=None, max_length=5000)
    metadata: dict[str, Any] | None = None


class InfrastructureResponse(ORMModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    infrastructure_type: InfrastructureType
    status: InfrastructureStatus
    criticality: Criticality
    description: str | None
    latitude: float | None
    longitude: float | None
    metadata: dict[str, Any] = Field(default_factory=dict, validation_alias=AliasChoices("meta", "metadata"))
    created_at: datetime
    updated_at: datetime

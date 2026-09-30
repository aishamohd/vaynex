from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from apps.api.schemas.common import ORMModel
from packages.common.enums import RecommendationPriority, RecommendationSource, RecommendationStatus


class RecommendationResponse(ORMModel):
    id: uuid.UUID
    incident_id: uuid.UUID
    title: str
    description: str
    priority: RecommendationPriority
    source: RecommendationSource
    status: RecommendationStatus
    decided_by: uuid.UUID | None = None
    decided_at: datetime | None = None
    decision_note: str | None = None
    created_at: datetime
    updated_at: datetime


class RecommendationUpdate(BaseModel):
    """Operator decision. Allowed transitions:
    PENDING -> ACCEPTED | REJECTED, ACCEPTED -> COMPLETED."""

    status: Literal["ACCEPTED", "REJECTED", "COMPLETED"]
    note: str | None = Field(default=None, max_length=2000)

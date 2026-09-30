from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from apps.api.schemas.incident import IncidentResponse


class DashboardEvent(BaseModel):
    id: uuid.UUID
    event_type: str
    severity: str
    title: str
    source: str
    occurred_at: datetime


class DashboardInfrastructure(BaseModel):
    id: uuid.UUID
    name: str
    infrastructure_type: str
    status: str
    criticality: str
    latitude: float | None
    longitude: float | None


class DashboardOverview(BaseModel):
    total_infrastructure: int
    operational_infrastructure: int
    degraded_infrastructure: int
    failed_infrastructure: int
    maintenance_infrastructure: int
    total_services: int
    disrupted_services: int
    active_incidents: int
    critical_incidents: int
    average_risk: float
    pending_recommendations: int
    recent_events: list[DashboardEvent]
    recent_incidents: list[IncidentResponse]
    critical_infrastructure: list[DashboardInfrastructure]
    generated_at: datetime
    cached: bool = False

"""Aggregates every v1 router under /api/v1."""

from __future__ import annotations

from fastapi import APIRouter

from apps.api.api.v1 import (
    audit,
    auth,
    dashboard,
    dependencies,
    events,
    health,
    incidents,
    infrastructure,
    intelligence,
    organizations,
    recommendations,
    risk,
    services,
    simulation,
)

api_router = APIRouter(prefix="/api/v1")
for module in (
    health,
    auth,
    organizations,
    infrastructure,
    services,
    dependencies,
    events,
    incidents,
    risk,
    intelligence,
    recommendations,
    dashboard,
    simulation,
    audit,
):
    api_router.include_router(module.router)

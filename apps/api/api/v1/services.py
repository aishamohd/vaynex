from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from apps.api.api.v1._common import CacheDep, PageParams
from apps.api.dependencies.auth import DbSession, OperatorUser, ViewerUser
from apps.api.schemas.common import Page
from apps.api.schemas.service import ServiceCreate, ServiceResponse, ServiceUpdate
from apps.api.services.service_service import PublicServiceService
from packages.common.enums import Criticality, ServiceStatus, ServiceType

router = APIRouter(prefix="/services", tags=["Public Services"])


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    data: ServiceCreate, session: DbSession, cache: CacheDep, user: OperatorUser
) -> ServiceResponse:
    return await PublicServiceService(session, cache).create(data, user)


@router.get("", response_model=Page[ServiceResponse])
async def list_services(
    session: DbSession,
    _: ViewerUser,
    page: PageParams,
    organization_id: uuid.UUID | None = None,
    service_type: Annotated[ServiceType | None, Query(alias="type")] = None,
    status_: Annotated[ServiceStatus | None, Query(alias="status")] = None,
    criticality: Criticality | None = None,
    infrastructure_id: uuid.UUID | None = None,
) -> Page[ServiceResponse]:
    return await PublicServiceService(session).list(
        organization_id=organization_id,
        service_type=service_type,
        status=status_,
        criticality=criticality,
        infrastructure_id=infrastructure_id,
        limit=page.limit,
        offset=page.offset,
    )


@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(service_id: uuid.UUID, session: DbSession, _: ViewerUser) -> ServiceResponse:
    return await PublicServiceService(session).get(service_id)


@router.patch("/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: uuid.UUID, data: ServiceUpdate, session: DbSession, cache: CacheDep, user: OperatorUser
) -> ServiceResponse:
    return await PublicServiceService(session, cache).update(service_id, data, user)

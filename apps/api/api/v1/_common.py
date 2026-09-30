"""Shared router helpers (pagination, service factories)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Query

from apps.api.core.cache import Cache
from apps.api.dependencies.database import get_ai_provider, get_cache
from packages.common.constants import DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT
from packages.intelligence import AIProvider


class Pagination:
    def __init__(
        self,
        limit: Annotated[int, Query(ge=1, le=MAX_PAGE_LIMIT, description="Page size")] = DEFAULT_PAGE_LIMIT,
        offset: Annotated[int, Query(ge=0, description="Items to skip")] = 0,
    ) -> None:
        self.limit = limit
        self.offset = offset


PageParams = Annotated[Pagination, Depends()]
CacheDep = Annotated[Cache, Depends(get_cache)]
AIProviderDep = Annotated[AIProvider, Depends(get_ai_provider)]

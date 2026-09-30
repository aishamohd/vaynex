"""Vaynex API application factory.

Run locally:  uvicorn apps.api.main:app --reload
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.api.v1.router import api_router
from apps.api.core.cache import Cache
from apps.api.core.config import Settings, get_settings
from apps.api.core.errors import register_exception_handlers
from apps.api.core.logging import configure_logging
from apps.api.core.middleware import REQUEST_ID_HEADER, RequestContextMiddleware
from apps.api.dependencies.database import Database
from packages.common.constants import ADVISORY_NOTICE
from packages.intelligence import build_ai_provider

logger = logging.getLogger("vaynex")

DESCRIPTION = f"""
**Vaynex** is an Agentic AI Public Infrastructure Intelligence Platform.

It connects infrastructure, public services, dependencies, events, incidents,
risk analysis and AI intelligence into recommendations for authorized human
operators.

> {ADVISORY_NOTICE}

Authenticate with `POST /api/v1/auth/login`, then click **Authorize** and paste
the `access_token`. Start the demo with `POST /api/v1/simulation/run`.
"""


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.LOG_LEVEL, settings.LOG_JSON)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = settings
        app.state.database = Database.from_settings(settings)
        app.state.cache = Cache(settings.REDIS_URL or None)
        app.state.ai_provider = build_ai_provider(
            preference=settings.AI_PROVIDER,
            openai_api_key=settings.openai_api_key,
            openai_model=settings.OPENAI_MODEL,
        )
        logger.info(
            "Vaynex %s starting (env=%s, ai_provider=%s)",
            settings.VERSION,
            settings.ENVIRONMENT,
            app.state.ai_provider.name,
        )
        try:
            yield
        finally:
            await app.state.cache.close()
            await app.state.database.dispose()
            logger.info("Vaynex stopped")

    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=DESCRIPTION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Middleware: the last added is outermost -> CORS wraps request context.
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", REQUEST_ID_HEADER],
        expose_headers=[REQUEST_ID_HEADER],
    )

    register_exception_handlers(app)
    app.include_router(api_router)

    @app.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "docs": "/docs",
            "health": "/api/v1/health",
        }

    return app


app = create_app()

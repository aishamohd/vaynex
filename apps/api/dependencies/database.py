"""Database / cache / AI provider dependencies.

The engine, cache and AI provider live on ``app.state`` (created in the
lifespan handler) so tests and scripts can build isolated apps.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from apps.api.core.cache import Cache
from apps.api.core.config import Settings
from packages.database.session import create_engine, create_session_factory
from packages.intelligence import AIProvider


@dataclass
class Database:
    engine: AsyncEngine
    session_factory: async_sessionmaker[AsyncSession]

    @classmethod
    def from_settings(cls, settings: Settings) -> Database:
        engine = create_engine(
            settings.DATABASE_URL,
            echo=settings.DATABASE_ECHO,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            null_pool=settings.DATABASE_USE_NULL_POOL,
        )
        return cls(engine=engine, session_factory=create_session_factory(engine))

    async def dispose(self) -> None:
        await self.engine.dispose()


async def get_db_session(request: Request) -> AsyncIterator[AsyncSession]:
    """One session per request. Services commit explicitly; anything left
    uncommitted (e.g. after an error) is rolled back here."""
    database: Database = request.app.state.database
    session = database.session_factory()
    try:
        yield session
    finally:
        if session.in_transaction():
            await session.rollback()
        await session.close()


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_cache(request: Request) -> Cache:
    return request.app.state.cache


def get_ai_provider(request: Request) -> AIProvider:
    return request.app.state.ai_provider

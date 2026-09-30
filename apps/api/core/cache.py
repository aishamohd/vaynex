"""Redis-backed JSON cache that degrades gracefully.

If Redis is down every operation becomes a no-op (after a short connection
timeout), and a simple circuit breaker skips Redis for ``cooldown_seconds``
so a dead cache never slows the API down.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError

logger = logging.getLogger("vaynex.cache")


class Cache:
    def __init__(self, url: str | None, *, cooldown_seconds: float = 30.0, timeout: float = 0.5) -> None:
        self._url = url
        self._cooldown = cooldown_seconds
        self._down_until = 0.0
        self._client: Redis | None = (
            Redis.from_url(url, socket_connect_timeout=timeout, socket_timeout=timeout, decode_responses=True)
            if url
            else None
        )

    @property
    def enabled(self) -> bool:
        return self._client is not None and time.monotonic() >= self._down_until

    def _trip(self, exc: Exception) -> None:
        self._down_until = time.monotonic() + self._cooldown
        logger.warning("Redis unavailable (%s); caching disabled for %.0fs", type(exc).__name__, self._cooldown)

    async def get_json(self, key: str) -> Any | None:
        if not self.enabled:
            return None
        try:
            raw = await self._client.get(key)  # type: ignore[union-attr]
        except (RedisError, OSError) as exc:
            self._trip(exc)
            return None
        return json.loads(raw) if raw else None

    async def set_json(self, key: str, value: Any, ttl_seconds: int) -> None:
        if not self.enabled or ttl_seconds <= 0:
            return
        try:
            await self._client.set(key, json.dumps(value, default=str), ex=ttl_seconds)  # type: ignore[union-attr]
        except (RedisError, OSError) as exc:
            self._trip(exc)

    async def delete(self, *keys: str) -> None:
        if not self.enabled or not keys:
            return
        try:
            await self._client.delete(*keys)  # type: ignore[union-attr]
        except (RedisError, OSError) as exc:
            self._trip(exc)

    async def ping(self) -> bool:
        """Health probe: always attempts a real round-trip (ignores the breaker)."""
        if self._client is None:
            return False
        try:
            return bool(await self._client.ping())
        except (RedisError, OSError):
            return False

    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.aclose()
            except (RedisError, OSError):  # pragma: no cover - best effort
                pass


class NullCache(Cache):
    """Cache that never stores anything (used when Redis is not configured)."""

    def __init__(self) -> None:
        super().__init__(None)

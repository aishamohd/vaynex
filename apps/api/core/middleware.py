"""Pure-ASGI request-id + access-log middleware."""

from __future__ import annotations

import logging
import time
import uuid

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from apps.api.core.logging import request_id_ctx
from packages.common.utils import is_valid_request_id

REQUEST_ID_HEADER = "X-Request-ID"
logger = logging.getLogger("vaynex.access")


class RequestContextMiddleware:
    """Assigns a request id (honouring a safe inbound ``X-Request-ID``),
    exposes it on ``request.state.request_id`` and the response header, and
    writes one sanitised access-log line per request (path only, no query
    string, no headers, no bodies)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        inbound = None
        for key, value in scope.get("headers", []):
            if key == b"x-request-id":
                inbound = value.decode("latin-1")
                break
        request_id = inbound if is_valid_request_id(inbound) else uuid.uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id
        token = request_id_ctx.set(request_id)
        start = time.perf_counter()
        status_holder = {"status": 500}

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                headers = MutableHeaders(scope=message)
                headers[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "%s %s -> %s (%.1f ms)",
                scope.get("method", "-"),
                scope.get("path", "-"),
                status_holder["status"],
                duration_ms,
            )
            request_id_ctx.reset(token)

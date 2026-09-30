"""Logging configuration with request-id correlation and secret redaction."""

from __future__ import annotations

import json
import logging
import re
import sys
from contextvars import ContextVar
from datetime import UTC, datetime

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)

# Patterns that must never reach log output.
_REDACTIONS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"(?i)bearer\s+[A-Za-z0-9\-_.=]+"), "Bearer [REDACTED]"),
    (re.compile(r"eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+"), "[REDACTED_JWT]"),
    (re.compile(r"sk-[A-Za-z0-9\-_]{10,}"), "[REDACTED_API_KEY]"),
    (
        re.compile(r"(?i)(\"?(?:password|passwd|secret|api_key|token)\"?\s*[:=]\s*)(\"[^\"]*\"|\S+)"),
        r"\1[REDACTED]",
    ),
]


def redact(message: str) -> str:
    for pattern, replacement in _REDACTIONS:
        message = pattern.sub(replacement, message)
    return message


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get() or "-"
        return True


class RedactingFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return redact(super().format(record))


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", "-"),
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return redact(json.dumps(payload, default=str))


def configure_logging(level: str = "INFO", json_logs: bool = False) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestContextFilter())
    if json_logs:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            RedactingFormatter("%(asctime)s %(levelname)-7s [%(name)s] [rid=%(request_id)s] %(message)s")
        )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
    # Uvicorn's access log prints full URLs (incl. query strings); Vaynex logs
    # its own sanitised access line in the request-id middleware instead.
    logging.getLogger("uvicorn.access").disabled = True
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

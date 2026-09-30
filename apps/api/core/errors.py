"""Application errors and the consistent JSON error envelope.

Every error response has the shape::

    {"error": {"code": "RESOURCE_NOT_FOUND", "message": "...", "request_id": "..."}}

Validation errors additionally include ``details`` (field locations/messages,
never the submitted input values).
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("vaynex.errors")


class AppError(Exception):
    status_code: int = 400
    code: str = "BAD_REQUEST"

    def __init__(self, message: str, *, code: str | None = None, details: Any = None) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        self.details = details


class BadRequestError(AppError):
    status_code = 400
    code = "BAD_REQUEST"


class AuthenticationError(AppError):
    status_code = 401
    code = "AUTHENTICATION_FAILED"


class PermissionDeniedError(AppError):
    status_code = 403
    code = "PERMISSION_DENIED"


class NotFoundError(AppError):
    status_code = 404
    code = "RESOURCE_NOT_FOUND"


class ConflictError(AppError):
    status_code = 409
    code = "RESOURCE_CONFLICT"


class DomainValidationError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"


_HTTP_CODES = {
    400: "BAD_REQUEST",
    401: "AUTHENTICATION_FAILED",
    403: "PERMISSION_DENIED",
    404: "RESOURCE_NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "RESOURCE_CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
}


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def error_body(code: str, message: str, request_id: str | None, details: Any = None) -> dict[str, Any]:
    body: dict[str, Any] = {"code": code, "message": message, "request_id": request_id}
    if details is not None:
        body["details"] = details
    return {"error": body}


def _response(
    request: Request, status: int, code: str, message: str, details: Any = None, headers: dict[str, str] | None = None
) -> JSONResponse:
    rid = _request_id(request)
    hdrs = dict(headers or {})
    if rid:
        hdrs["X-Request-ID"] = rid
    return JSONResponse(status_code=status, content=error_body(code, message, rid, details), headers=hdrs)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
    return _response(request, exc.status_code, exc.code, exc.message, exc.details, headers)


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = [
        {"loc": [str(p) for p in err.get("loc", ())], "msg": err.get("msg", ""), "type": err.get("type", "")}
        for err in exc.errors()
    ]
    return _response(request, 422, "VALIDATION_ERROR", "Request validation failed", details)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _HTTP_CODES.get(exc.status_code, "HTTP_ERROR")
    message = exc.detail if isinstance(exc.detail, str) else code.replace("_", " ").capitalize()
    return _response(request, exc.status_code, code, message, headers=getattr(exc, "headers", None))


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    logger.warning("Integrity error: %s", type(exc.orig).__name__ if exc.orig else "unknown")
    return _response(request, 409, "RESOURCE_CONFLICT", "The request conflicts with existing data")


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error while processing %s %s", request.method, request.url.path)
    return _response(request, 500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred")


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(IntegrityError, integrity_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_error_handler)

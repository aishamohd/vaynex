"""App-level security helpers: token issuing and role hierarchy."""

from __future__ import annotations

from typing import Any

from apps.api.core.config import Settings
from packages.common.enums import UserRole
from packages.security.jwt import create_access_token, decode_access_token

ROLE_RANK: dict[UserRole, int] = {
    UserRole.VIEWER: 0,
    UserRole.OPERATOR: 1,
    UserRole.ADMIN: 2,
}


def role_satisfies(actual: UserRole | str, required: UserRole | str) -> bool:
    """ADMIN > OPERATOR > VIEWER: a higher role satisfies any lower requirement."""
    return ROLE_RANK[UserRole(actual)] >= ROLE_RANK[UserRole(required)]


def issue_access_token(settings: Settings, *, user_id: str, role: str) -> str:
    return create_access_token(
        subject=user_id,
        role=role,
        secret_key=settings.jwt_secret,
        algorithm=settings.JWT_ALGORITHM,
        expires_minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    )


def read_access_token(settings: Settings, token: str) -> dict[str, Any]:
    return decode_access_token(token, secret_key=settings.jwt_secret, algorithm=settings.JWT_ALGORITHM)

"""Authentication and role-based authorization dependencies."""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.config import Settings
from apps.api.core.errors import AuthenticationError, PermissionDeniedError
from apps.api.core.security import read_access_token, role_satisfies
from apps.api.dependencies.database import get_db_session, get_settings_dep
from packages.common.enums import UserRole
from packages.database.models import User
from packages.database.repositories.user import UserRepository
from packages.security.jwt import TokenError

bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token from /api/v1/auth/login")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthenticationError("Missing bearer token", code="NOT_AUTHENTICATED")
    try:
        claims = read_access_token(settings, credentials.credentials)
        user_id = uuid.UUID(str(claims["sub"]))
    except (TokenError, ValueError, KeyError) as exc:
        raise AuthenticationError(str(exc) or "Invalid token", code="INVALID_TOKEN") from exc

    user = await UserRepository(session).get(user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("User not found or inactive", code="INVALID_TOKEN")
    return user


def require_role(minimum: UserRole) -> Callable[..., Awaitable[User]]:
    """Dependency factory enforcing the ADMIN > OPERATOR > VIEWER hierarchy."""

    async def _checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        if not role_satisfies(user.role, minimum):
            raise PermissionDeniedError(f"This action requires the {minimum.value} role or higher")
        return user

    _checker.__name__ = f"require_{minimum.value.lower()}"
    return _checker


CurrentUser = Annotated[User, Depends(get_current_user)]
ViewerUser = Annotated[User, Depends(require_role(UserRole.VIEWER))]
OperatorUser = Annotated[User, Depends(require_role(UserRole.OPERATOR))]
AdminUser = Annotated[User, Depends(require_role(UserRole.ADMIN))]
DbSession = Annotated[AsyncSession, Depends(get_db_session)]

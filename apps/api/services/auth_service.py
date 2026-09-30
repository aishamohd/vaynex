"""Registration, login and current-user lookup."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.config import Settings
from apps.api.core.errors import AuthenticationError, ConflictError
from apps.api.core.security import issue_access_token
from apps.api.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from apps.api.services.audit_service import AuditService
from packages.common.enums import AuditAction, UserRole
from packages.database.models import User
from packages.database.repositories import UserRepository
from packages.security.password import hash_password, needs_rehash, verify_password

# Verifying against a real hash when the user does not exist keeps login
# timing uniform and avoids leaking which e-mails are registered.
_DUMMY_HASH = hash_password("vaynex-timing-equaliser-0")


class AuthService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.users = UserRepository(session)
        self.audit = AuditService(session)

    async def register(self, data: RegisterRequest) -> UserResponse:
        if await self.users.get_by_email(data.email):
            raise ConflictError("An account with this email already exists", code="EMAIL_ALREADY_REGISTERED")
        user = await self.users.create(
            email=data.email,
            full_name=data.full_name,
            password_hash=hash_password(data.password),
            role=UserRole.VIEWER,  # self-registration is always read-only
            is_active=True,
        )
        self.audit.record(
            AuditAction.USER_REGISTERED, "user", user.id, user_id=user.id, details={"role": UserRole.VIEWER.value}
        )
        await self.session.commit()
        return UserResponse.model_validate(user)

    async def login(self, data: LoginRequest) -> TokenResponse:
        user = await self.users.get_by_email(data.email)
        valid = verify_password(data.password, user.password_hash if user else _DUMMY_HASH)
        if user is None or not valid or not user.is_active:
            self.audit.record(
                AuditAction.USER_LOGIN_FAILED,
                "user",
                user.id if user else None,
                details={"email": data.email, "reason": "inactive" if user and valid else "invalid_credentials"},
            )
            await self.session.commit()
            raise AuthenticationError("Invalid email or password", code="INVALID_CREDENTIALS")

        if needs_rehash(user.password_hash):
            user.password_hash = hash_password(data.password)
        token = issue_access_token(self.settings, user_id=str(user.id), role=str(user.role))
        self.audit.record(AuditAction.USER_LOGIN, "user", user.id, user_id=user.id, details={"role": str(user.role)})
        await self.session.commit()
        return TokenResponse(
            access_token=token,
            expires_in=self.settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user),
        )

    @staticmethod
    def me(user: User) -> UserResponse:
        return UserResponse.model_validate(user)

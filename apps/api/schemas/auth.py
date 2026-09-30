from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from apps.api.schemas.common import ORMModel
from packages.common.enums import UserRole
from packages.common.utils import normalize_email


class _EmailMixin(BaseModel):
    email: str = Field(max_length=254, examples=["operator@vaynex.local"])

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return normalize_email(value)


class RegisterRequest(_EmailMixin):
    password: str = Field(min_length=8, max_length=128, examples=["S3cure-Passw0rd!"])
    full_name: str | None = Field(default=None, max_length=200)

    @field_validator("password")
    @classmethod
    def _password_strength(cls, value: str) -> str:
        if value.strip() != value:
            raise ValueError("Password must not start or end with whitespace")
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one letter and one digit")
        return value


class LoginRequest(_EmailMixin):
    password: str = Field(min_length=1, max_length=128)


class UserResponse(ORMModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    role: UserRole
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Token lifetime in seconds")
    user: UserResponse

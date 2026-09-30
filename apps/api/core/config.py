"""Application settings loaded from environment variables / .env."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Annotated, Any, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

INSECURE_DEFAULT_SECRET = "change-me-in-development"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False)

    PROJECT_NAME: str = "Vaynex"
    ENVIRONMENT: Literal["development", "test", "staging", "production"] = "development"
    VERSION: str = "0.1.0"

    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://vaynex:vaynex@localhost:5433/vaynex"
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_USE_NULL_POOL: bool = False
    DATABASE_ECHO: bool = False

    REDIS_URL: str = "redis://localhost:6380/0"
    DASHBOARD_CACHE_TTL_SECONDS: int = 15

    JWT_SECRET_KEY: SecretStr = SecretStr(INSECURE_DEFAULT_SECRET)
    JWT_ALGORITHM: Literal["HS256", "HS384", "HS512"] = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60, ge=1, le=24 * 60)

    AI_PROVIDER: Literal["auto", "mock", "openai"] = "auto"
    OPENAI_API_KEY: SecretStr | None = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    CORS_ALLOWED_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    @field_validator("CORS_ALLOWED_ORIGINS", mode="before")
    @classmethod
    def _parse_origins(cls, value: Any) -> Any:
        """Accept a JSON list (``["http://a"]``) or a comma separated string."""
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("["):
                return json.loads(raw)
            return [item.strip() for item in raw.split(",") if item.strip()]
        return value

    @field_validator("OPENAI_API_KEY", mode="before")
    @classmethod
    def _empty_key_is_none(cls, value: Any) -> Any:
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        return value

    @model_validator(mode="after")
    def _guard_production(self) -> Settings:
        if self.ENVIRONMENT == "production":
            secret = self.JWT_SECRET_KEY.get_secret_value()
            if secret == INSECURE_DEFAULT_SECRET or len(secret) < 32:
                raise ValueError("JWT_SECRET_KEY must be a strong (>=32 chars) secret in production")
        return self

    @property
    def openai_api_key(self) -> str | None:
        return self.OPENAI_API_KEY.get_secret_value() if self.OPENAI_API_KEY else None

    @property
    def jwt_secret(self) -> str:
        return self.JWT_SECRET_KEY.get_secret_value()


@lru_cache
def get_settings() -> Settings:
    return Settings()

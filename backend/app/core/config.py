from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # App
    app_name: str = "RevenuePilot AI API"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"
    debug: bool = True

    # Database
    database_url: str = (
        "postgresql+asyncpg://revenuepilot:revenuepilot@localhost:5432/revenuepilot"
    )

    # JWT
    jwt_secret_key: str = "change-me-in-production-super-secret-key"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # CORS
    cors_origins: list[str] = ["*"]

    # AI / LLM
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    ai_enabled: bool = True  # falls back to heuristics if no key

    # Telegram
    telegram_bot_token: str | None = None
    telegram_group_chat_id: int | None = None
    telegram_webhook_secret: str | None = None

    @field_validator(
        "openai_api_key",
        "telegram_bot_token",
        "telegram_group_chat_id",
        "telegram_webhook_secret",
        mode="before",
    )
    @classmethod
    def _empty_str_to_none(cls, value: object) -> object:
        # Env vars left blank (e.g. docker-compose "${VAR:-}") should be treated as unset.
        if isinstance(value, str) and value.strip() == "":
            return None
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

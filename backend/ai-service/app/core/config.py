from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Single env file at backend/.env (this file lives in backend/ai-service/app/core/).
_BACKEND_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_ENV),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    internal_api_key: str = ""
    # Distinct from node-api's NODE_API_PORT — shared .env cannot reuse PORT for both.
    risk_service_port: int = 8000


@lru_cache
def get_settings() -> Settings:
    return Settings()

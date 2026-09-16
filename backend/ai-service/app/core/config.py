from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    internal_api_key: str = ""
    port: int = 8000


@lru_cache
def get_settings() -> Settings:
    return Settings()

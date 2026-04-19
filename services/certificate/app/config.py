from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    auth_service_url: str 
    earnings_service_url: str


@lru_cache
def get_settings() -> Settings:
    return Settings()

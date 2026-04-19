from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    async_database_url: str
    jwt_secret: str 
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    cloudinary_cloud_name: str
    cloudinary_api_key: str 
    cloudinary_api_secret: str 
    auth_service_url: str 


@lru_cache
def get_settings() -> Settings:
    return Settings()

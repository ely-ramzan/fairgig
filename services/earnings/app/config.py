from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import cloudinary


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    async_database_url: str 
    auth_service_url: str 
    cloudinary_cloud_name: str 
    cloudinary_api_key: str 
    cloudinary_api_secret: str 


@lru_cache
def get_settings() -> Settings:
    return Settings()

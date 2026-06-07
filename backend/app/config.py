from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_expires_minutes: int = 12 * 60
    cors_origins: str = "*"

    bootstrap_admin: bool = True
    admin_username: str = "admin"
    admin_password: str = "admin1234"

    master_key: Optional[str] = None

    # S3 / MinIO — optional
    s3_endpoint_url: Optional[str] = None
    s3_access_key: Optional[str] = None
    s3_secret_key: Optional[str] = None
    s3_bucket: str = "support-attachments"
    s3_region: str = "us-east-1"

    @property
    def s3_enabled(self) -> bool:
        return bool(self.s3_endpoint_url and self.s3_access_key and self.s3_secret_key)


settings = Settings()  # type: ignore


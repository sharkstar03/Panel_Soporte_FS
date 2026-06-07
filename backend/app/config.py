from typing import Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Valores notoriamente inseguros que NO deben usarse en producción.
INSECURE_SECRETS = {
    "",
    "cambia_esto_en_produccion",
    "cambia_esto",
    "default-secret-key",
    "secret",
    "changeme",
    "pon_un_secreto_largo",
}

INSECURE_PASSWORDS = {
    "",
    "admin",
    "admin1234",
    "password",
    "123456",
    "changeme",
    "cambia_esto",
}

# Longitud mínima exigida a secretos criptográficos en producción.
MIN_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    # "production" (por defecto) aplica validaciones estrictas de seguridad.
    # Usar "development" SOLO en entornos locales de prueba.
    app_env: str = "production"

    database_url: str
    jwt_secret: str
    jwt_expires_minutes: int = 12 * 60
    cors_origins: str = ""

    bootstrap_admin: bool = True
    admin_username: str = "admin"
    admin_password: str = ""

    # Clave maestra dedicada para cifrar la bóveda de secretos (passwords, OTP,
    # llaves, credenciales remotas, SMTP). DEBE ser independiente de jwt_secret.
    master_key: Optional[str] = None

    # Límite de tamaño de subida de archivos (MB).
    max_upload_mb: int = 25

    # S3 / MinIO — optional
    s3_endpoint_url: Optional[str] = None
    s3_access_key: Optional[str] = None
    s3_secret_key: Optional[str] = None
    s3_bucket: str = "support-attachments"
    s3_region: str = "us-east-1"

    @property
    def s3_enabled(self) -> bool:
        return bool(self.s3_endpoint_url and self.s3_access_key and self.s3_secret_key)

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() not in ("development", "dev", "local", "test")

    @model_validator(mode="after")
    def _validate_security(self) -> "Settings":
        if not self.is_production:
            return self

        errors: list[str] = []

        if self.jwt_secret in INSECURE_SECRETS or len(self.jwt_secret) < MIN_SECRET_LENGTH:
            errors.append(
                f"JWT_SECRET inseguro o demasiado corto (mínimo {MIN_SECRET_LENGTH} caracteres "
                "aleatorios). Genera uno con: openssl rand -hex 32"
            )

        if not self.master_key or self.master_key in INSECURE_SECRETS or len(self.master_key) < MIN_SECRET_LENGTH:
            errors.append(
                f"MASTER_KEY es obligatoria en producción y debe tener al menos {MIN_SECRET_LENGTH} "
                "caracteres aleatorios. Genera una con: openssl rand -hex 32"
            )

        if self.master_key and self.master_key == self.jwt_secret:
            errors.append("MASTER_KEY debe ser DISTINTA de JWT_SECRET.")

        if self.bootstrap_admin and self.admin_password in INSECURE_PASSWORDS:
            errors.append(
                "ADMIN_PASSWORD inseguro o vacío. Define una contraseña fuerte en la variable "
                "ADMIN_PASSWORD (o desactiva el bootstrap con BOOTSTRAP_ADMIN=false)."
            )

        if self.cors_origins.strip() == "*":
            errors.append(
                "CORS_ORIGINS no puede ser '*' en producción. Especifica los orígenes permitidos "
                "separados por coma (ej: https://panel.midominio.com)."
            )

        if errors:
            raise ValueError(
                "Configuración insegura detectada (APP_ENV=production):\n  - "
                + "\n  - ".join(errors)
                + "\n\nPara desarrollo local puedes usar APP_ENV=development."
            )

        return self


settings = Settings()  # type: ignore

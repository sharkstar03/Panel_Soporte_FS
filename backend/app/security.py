from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Política mínima de contraseñas para cuentas creadas/cambiadas vía API.
MIN_PASSWORD_LENGTH = 10
COMMON_PASSWORDS = {
    "admin1234", "password", "12345678", "123456789", "qwerty123",
    "contraseña", "soporte123", "admin12345", "changeme123",
}


def password_policy_errors(password: str) -> list[str]:
    """Devuelve una lista de problemas de la contraseña (vacía = válida)."""
    errors: list[str] = []
    if len(password) < MIN_PASSWORD_LENGTH:
        errors.append(f"Debe tener al menos {MIN_PASSWORD_LENGTH} caracteres.")
    if not any(c.isalpha() for c in password):
        errors.append("Debe incluir al menos una letra.")
    if not any(c.isdigit() for c in password):
        errors.append("Debe incluir al menos un número.")
    if password.lower() in COMMON_PASSWORDS:
        errors.append("Es una contraseña demasiado común.")
    return errors


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.jwt_expires_minutes)
    payload = {"sub": subject, "iat": int(now.timestamp()), "exp": exp, "scope": "access"}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_2fa_pending_token(subject: str, expires_minutes: int = 10) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=expires_minutes)
    payload = {"sub": subject, "iat": int(now.timestamp()), "exp": exp, "scope": "2fa_pending"}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("scope") != "access":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def decode_2fa_pending_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("scope") != "2fa_pending":
            return None
        return payload.get("sub")
    except JWTError:
        return None


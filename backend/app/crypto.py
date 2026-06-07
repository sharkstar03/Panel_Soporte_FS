import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import settings


def _get_secret() -> str:
    """Devuelve el secreto base para derivar la clave de cifrado de la bóveda.

    En producción exige una MASTER_KEY dedicada (validada además en config.py).
    En desarrollo, si no hay MASTER_KEY, cae a jwt_secret como conveniencia.
    Nunca usa un valor hardcodeado.
    """
    if settings.master_key:
        return settings.master_key
    if not settings.is_production and settings.jwt_secret:
        return settings.jwt_secret
    raise RuntimeError(
        "MASTER_KEY no está configurada: la bóveda de secretos no puede cifrar/descifrar. "
        "Define la variable de entorno MASTER_KEY (openssl rand -hex 32)."
    )


def _get_fernet() -> Fernet:
    raw = _get_secret().encode()
    digest = hashlib.sha256(raw).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_value(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_value(cipher: str) -> str:
    return _get_fernet().decrypt(cipher.encode()).decode()

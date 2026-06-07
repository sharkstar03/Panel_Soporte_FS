import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import settings


def _get_fernet() -> Fernet:
    raw = (settings.master_key or settings.jwt_secret or "default-secret-key").encode()
    digest = hashlib.sha256(raw).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_value(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_value(cipher: str) -> str:
    return _get_fernet().decrypt(cipher.encode()).decode()

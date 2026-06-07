"""Regresión de la validación de configuración segura en producción."""
import pytest

from app.config import Settings


def _base_env(**over):
    env = dict(
        app_env="production",
        database_url="postgresql+psycopg://u:p@db:5432/x",
        jwt_secret="a" * 40,
        master_key="b" * 40,
        cors_origins="https://panel.example.com",
        admin_password="Str0ng#Pass2026!",
        bootstrap_admin=True,
    )
    env.update(over)
    return env


def test_valid_production_config_ok():
    s = Settings(**_base_env())
    assert s.is_production is True


def test_rejects_weak_jwt_secret():
    with pytest.raises(ValueError):
        Settings(**_base_env(jwt_secret="short"))


def test_rejects_missing_master_key():
    with pytest.raises(ValueError):
        Settings(**_base_env(master_key=None))


def test_rejects_master_key_equal_jwt():
    with pytest.raises(ValueError):
        Settings(**_base_env(jwt_secret="c" * 40, master_key="c" * 40))


def test_rejects_insecure_admin_password():
    with pytest.raises(ValueError):
        Settings(**_base_env(admin_password="admin1234"))


def test_rejects_wildcard_cors():
    with pytest.raises(ValueError):
        Settings(**_base_env(cors_origins="*"))


def test_development_allows_weak_values():
    s = Settings(
        app_env="development",
        database_url="sqlite:///x.db",
        jwt_secret="dev",
        cors_origins="*",
        admin_password="admin1234",
    )
    assert s.is_production is False

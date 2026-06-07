"""Configuración de pytest.

Levanta la app contra una base SQLite temporal y en modo desarrollo, de modo
que los tests corren sin PostgreSQL ni servicios externos (ideal para CI).
Las variables de entorno se fijan ANTES de importar la app, porque
`app.config.Settings` se instancia al importar.
"""
import os
import tempfile

# --- Entorno de prueba (debe ir antes de importar la app) ---
_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_db_path}")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-not-for-production")
os.environ.setdefault("MASTER_KEY", "test-master-key-not-for-production")
os.environ.setdefault("CORS_ORIGINS", "*")
os.environ.setdefault("BOOTSTRAP_ADMIN", "true")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "admin1234")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    # El context manager dispara el startup (crea tablas, seeds, admin).
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_token(client):
    r = client.post("/auth/login", json={"username": "admin", "password": "admin1234"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(autouse=True)
def _reset_login_rate():
    """Evita que el rate limiting de login (en memoria) contamine otros tests."""
    from app.routers import auth as auth_router
    auth_router._login_attempts.clear()
    yield
    auth_router._login_attempts.clear()

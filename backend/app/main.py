from pathlib import Path
from tempfile import NamedTemporaryFile

import requests
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlmodel import Session, select

from app.audit import log_event
from app.config import settings
from app.db import init_db, engine
from app.migrations import run_migrations
from app.models import SessionEventType, User, UserRole
from app.placeft.scraper import _api_base, _portal_base
from app.routers import admin, approve, assets, attachments, auth, branches, documents, document_templates, kb, links, otp, passwords, printers, rbac, security_keys, sessions, users, audit
from app.routers import settings as settings_router
from app.s3 import ensure_bucket, s3_client
from app.security import hash_password

# En producción se ocultan la documentación interactiva y el esquema OpenAPI
# para no exponer el mapa completo de la API a usuarios no autenticados.
_docs_enabled = not settings.is_production
app = FastAPI(
    title="Panel Soporte - API",
    version="0.1.0",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

# Orígenes permitidos para CORS. No se combina el comodín "*" con
# allow_credentials=True (configuración inválida/insegura): cuando se permite
# cualquier origen, las credenciales quedan deshabilitadas.
_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
_allow_all_origins = _cors_origins == ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=not _allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(branches.router)
app.include_router(assets.router)
app.include_router(sessions.router)
app.include_router(attachments.router)
app.include_router(links.router)
app.include_router(kb.router)
app.include_router(audit.router)
app.include_router(settings_router.router)
app.include_router(passwords.router)
app.include_router(printers.router)
app.include_router(otp.router)
app.include_router(security_keys.router)
app.include_router(documents.router)
app.include_router(document_templates.router)
app.include_router(approve.router)
app.include_router(admin.router)
app.include_router(rbac.router)


@app.on_event("startup")
def on_startup():
    run_migrations()
    init_db()
    ensure_bucket()

    with Session(engine) as db:
        from app.settings_helper import seed_settings
        seed_settings(db)
        from app.rbac_seed import seed_rbac
        seed_rbac(db)

        if settings.bootstrap_admin:
            existing = db.exec(select(User).where(User.username == settings.admin_username)).first()
            if not existing:
                admin = User(
                    username=settings.admin_username,
                    password_hash=hash_password(settings.admin_password),
                    role=UserRole.admin,
                )
                db.add(admin)
                db.commit()
                db.refresh(admin)
                log_event(db, SessionEventType.user_created, user_id=admin.id, metadata={"username": admin.username, "role": admin.role})


def _check_db() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def _check_storage() -> bool:
    try:
        if settings.s3_enabled:
            client = s3_client()
            if client is None:
                return False
            client.head_bucket(Bucket=settings.s3_bucket)
            return True

        # Almacenamiento local: verificar que el directorio exista y sea escribible.
        storage_dir = Path(__file__).resolve().parent / "storage"
        storage_dir.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(dir=storage_dir, delete=True):
            return True
    except Exception:
        return False


def _check_dgi() -> bool:
    """Verifica que la API de la DGI/PlaceFT responda (sin requerir credenciales)."""
    try:
        r = requests.head(f"{_api_base()}/", timeout=5, allow_redirects=True)
        if r.status_code >= 500:
            return False
        return True
    except Exception:
        pass

    try:
        r = requests.head(f"{_portal_base()}/Contribuyente/inicio-sesion", timeout=5, allow_redirects=True)
        if r.status_code >= 500:
            return False
        return True
    except Exception:
        return False


@app.get("/health")
def health():
    db_ok = _check_db()
    storage_ok = _check_storage()
    dgi_ok = _check_dgi()
    status = "ok" if db_ok and storage_ok and dgi_ok else "fail"
    code = 200 if status == "ok" else 503
    return Response(
        status_code=code,
        media_type="application/json",
        content=(
            f'{{"status":"{status}","db":{str(db_ok).lower()},"storage":{str(storage_ok).lower()},'
            f'"dgi":{str(dgi_ok).lower()},"version":"0.1.0"}}'
        ),
    )

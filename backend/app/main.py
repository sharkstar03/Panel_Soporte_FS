from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from app.audit import log_event
from app.config import settings
from app.db import init_db, engine
from app.migrations import run_migrations
from app.models import SessionEventType, User, UserRole
from app.routers import admin, approve, assets, attachments, auth, branches, documents, document_templates, kb, links, otp, passwords, rbac, security_keys, sessions, users, audit
from app.routers import settings as settings_router
from app.s3 import ensure_bucket
from app.security import hash_password

app = FastAPI(title="Panel Soporte - API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")] if settings.cors_origins != "*" else ["*"],
    allow_credentials=True,
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


@app.get("/health")
def health():
    return {"ok": True}

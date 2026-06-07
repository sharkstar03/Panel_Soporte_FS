from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, delete

from app.audit import log_event
from app.deps import get_current_user, get_db, require_permissions
from app.models import (
    Document, DocumentEvidence, DocumentStatus,
    SupportSession, SessionStatus,
    SessionEvent, SessionEventType,
    User,
)

router = APIRouter(prefix="/admin", tags=["admin"])

_admin_only = Depends(require_permissions("admin.purge"))


# ── Schemas ────────────────────────────────────────────────────────────────

class PurgeDocumentsIn(BaseModel):
    older_than_days: int
    status: str = "all"   # "all" | "pending" | "approved" | "rejected"


class PurgeSessionsIn(BaseModel):
    older_than_days: int
    only_closed: bool = True


class PurgeAuditIn(BaseModel):
    older_than_days: int


class PurgePreview(BaseModel):
    documents: int
    sessions: int
    audit_events: int


# ── Preview ────────────────────────────────────────────────────────────────

@router.get("/purge/preview", response_model=PurgePreview, dependencies=[_admin_only])
def purge_preview(days: int = 30, db: Session = Depends(get_db)):
    """Cuenta cuántos registros serían eliminados con la purga de N días. 0 = todos."""
    if days < 0:
        raise HTTPException(status_code=400, detail="El valor no puede ser negativo")

    # days=0 → cutoff=ahora → todos los registros califican
    cutoff = datetime.utcnow() - timedelta(days=days) + timedelta(seconds=1)

    doc_count = len(db.exec(
        select(Document).where(Document.created_at < cutoff)
    ).all())

    ses_count = len(db.exec(
        select(SupportSession).where(
            SupportSession.start_at < cutoff,
            SupportSession.status == SessionStatus.closed,
        )
    ).all())

    audit_count = len(db.exec(
        select(SessionEvent).where(SessionEvent.at < cutoff)
    ).all())

    return PurgePreview(documents=doc_count, sessions=ses_count, audit_events=audit_count)


# ── Purge Documents ────────────────────────────────────────────────────────

@router.delete("/purge/documents", dependencies=[_admin_only])
def purge_documents(
    payload: PurgeDocumentsIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.older_than_days < 0:
        raise HTTPException(status_code=400, detail="El valor no puede ser negativo")

    # 0 días = eliminar todos sin restricción de fecha
    cutoff = datetime.utcnow() - timedelta(days=payload.older_than_days) + timedelta(seconds=1)

    stmt = select(Document).where(Document.created_at < cutoff)
    if payload.status != "all":
        stmt = stmt.where(Document.status == payload.status)

    docs = db.exec(stmt).all()
    if not docs:
        return {"deleted": 0, "message": "No hay registros que cumplan el criterio"}

    doc_ids = [d.id for d in docs]

    # Eliminar evidencias relacionadas primero
    evidence = db.exec(
        select(DocumentEvidence).where(DocumentEvidence.document_id.in_(doc_ids))
    ).all()
    for ev in evidence:
        db.delete(ev)
    db.flush()

    for doc in docs:
        db.delete(doc)
    db.commit()

    log_event(
        db, SessionEventType.document_deleted if hasattr(SessionEventType, 'document_deleted')
        else SessionEventType.asset_deleted,
        user_id=user.id,
        metadata={
            "action": "purge_documents",
            "count": len(docs),
            "older_than_days": payload.older_than_days,
            "status_filter": payload.status,
        },
    )

    return {"deleted": len(docs), "message": f"Se eliminaron {len(docs)} documentos"}


# ── Purge Sessions ─────────────────────────────────────────────────────────

@router.delete("/purge/sessions", dependencies=[_admin_only])
def purge_sessions(
    payload: PurgeSessionsIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.older_than_days < 0:
        raise HTTPException(status_code=400, detail="El valor no puede ser negativo")

    cutoff = datetime.utcnow() - timedelta(days=payload.older_than_days) + timedelta(seconds=1)

    stmt = select(SupportSession).where(SupportSession.start_at < cutoff)
    if payload.only_closed:
        stmt = stmt.where(SupportSession.status == SessionStatus.closed)

    sessions = db.exec(stmt).all()
    if not sessions:
        return {"deleted": 0, "message": "No hay sesiones que cumplan el criterio"}

    session_ids = [s.id for s in sessions]

    # Eliminar eventos de sesión relacionados
    events = db.exec(
        select(SessionEvent).where(SessionEvent.session_id.in_(session_ids))
    ).all()
    for ev in events:
        db.delete(ev)
    db.flush()

    for s in sessions:
        db.delete(s)
    db.commit()

    log_event(
        db, SessionEventType.session_closed,
        user_id=user.id,
        metadata={
            "action": "purge_sessions",
            "count": len(sessions),
            "older_than_days": payload.older_than_days,
            "only_closed": payload.only_closed,
        },
    )

    return {"deleted": len(sessions), "message": f"Se eliminaron {len(sessions)} sesiones"}


# ── Purge Audit Log ────────────────────────────────────────────────────────

@router.delete("/purge/audit", dependencies=[_admin_only])
def purge_audit(
    payload: PurgeAuditIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.older_than_days < 0:
        raise HTTPException(status_code=400, detail="El valor no puede ser negativo")

    cutoff = datetime.utcnow() - timedelta(days=payload.older_than_days) + timedelta(seconds=1)

    # Eventos sin session_id o cuya sesión ya no existe
    events = db.exec(
        select(SessionEvent).where(
            SessionEvent.at < cutoff,
            SessionEvent.session_id == None,  # noqa: E711
        )
    ).all()

    if not events:
        return {"deleted": 0, "message": "No hay eventos de auditoría huérfanos que cumplan el criterio"}

    for ev in events:
        db.delete(ev)
    db.commit()

    log_event(
        db, SessionEventType.setting_updated,
        user_id=user.id,
        metadata={
            "action": "purge_audit",
            "count": len(events),
            "older_than_days": payload.older_than_days,
        },
    )

    return {"deleted": len(events), "message": f"Se eliminaron {len(events)} eventos de auditoría"}

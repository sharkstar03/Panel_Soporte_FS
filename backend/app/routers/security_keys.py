from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.audit import log_event
from app.crypto import decrypt_value, encrypt_value
from app.deps import get_current_user, get_db, require_permissions
from app.models import SecurityKeyEntry, SessionEventType, User, UserRole
from app.schemas import SecurityKeyCreateIn, SecurityKeyOut, SecurityKeyRevealOut

router = APIRouter(prefix="/security-keys", tags=["security_keys"])


def _to_out(e: SecurityKeyEntry) -> SecurityKeyOut:
    return SecurityKeyOut(
        id=e.id, title=e.title, key_type=e.key_type, description=e.description,
        expires_at=e.expires_at, category=e.category, roles_allowed=e.roles_allowed,
        created_by_id=e.created_by_id, created_at=e.created_at, updated_at=e.updated_at,
    )


@router.post("", response_model=SecurityKeyOut, dependencies=[Depends(require_permissions("security_keys.manage"))])
def create_key(payload: SecurityKeyCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    entry = SecurityKeyEntry(
        title=payload.title, key_type=payload.key_type,
        content_encrypted=encrypt_value(payload.content),
        description=payload.description, expires_at=payload.expires_at,
        category=payload.category, roles_allowed=payload.roles_allowed,
        created_by_id=user.id, updated_at=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    log_event(db, SessionEventType.seckey_created, user_id=user.id, metadata={"entry_id": entry.id, "title": entry.title})
    return _to_out(entry)


@router.get("", response_model=list[SecurityKeyOut], dependencies=[Depends(require_permissions("security_keys.view"))])
def list_keys(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    entries = db.exec(select(SecurityKeyEntry).order_by(SecurityKeyEntry.category, SecurityKeyEntry.title)).all()
    return [
        _to_out(e) for e in entries
        if user.role == UserRole.admin or user.role in [r.strip() for r in e.roles_allowed.split(",")]
    ]


@router.get("/{entry_id}/reveal", response_model=SecurityKeyRevealOut, dependencies=[Depends(require_permissions("security_keys.reveal"))])
def reveal_key(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = db.get(SecurityKeyEntry, entry_id)
    if not e:
        raise HTTPException(status_code=404, detail="Clave no encontrada")
    roles = [r.strip() for r in e.roles_allowed.split(",")]
    if user.role not in roles and user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="No autorizado")
    log_event(db, SessionEventType.seckey_viewed, user_id=user.id, metadata={"entry_id": e.id})
    return SecurityKeyRevealOut(**_to_out(e).model_dump(), content=decrypt_value(e.content_encrypted))


@router.delete("/{entry_id}", dependencies=[Depends(require_permissions("security_keys.manage"))])
def delete_key(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = db.get(SecurityKeyEntry, entry_id)
    if not e:
        raise HTTPException(status_code=404, detail="Clave no encontrada")
    log_event(db, SessionEventType.seckey_deleted, user_id=user.id, metadata={"entry_id": e.id, "title": e.title})
    db.delete(e)
    db.commit()
    return {"ok": True}

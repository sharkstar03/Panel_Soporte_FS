from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.audit import log_event
from app.crypto import decrypt_value, encrypt_value
from app.deps import get_current_user, get_db, require_permissions
from app.models import PasswordEntry, SessionEventType, User, UserRole
from app.schemas import PasswordCreateIn, PasswordOut

router = APIRouter(prefix="/passwords", tags=["passwords"])


@router.post("", response_model=PasswordOut, dependencies=[Depends(require_permissions("passwords.manage"))])
def create_password(payload: PasswordCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    entry = PasswordEntry(
        title=payload.title,
        username=payload.username,
        password_encrypted=encrypt_value(payload.password),
        url=payload.url,
        notes=payload.notes,
        category=payload.category,
        roles_allowed=payload.roles_allowed,
        created_by_id=user.id,
        updated_at=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    log_event(db, SessionEventType.password_created, user_id=user.id, metadata={"entry_id": entry.id, "title": entry.title})
    return PasswordOut(
        id=entry.id,
        title=entry.title,
        username=entry.username,
        url=entry.url,
        notes=entry.notes,
        category=entry.category,
        roles_allowed=entry.roles_allowed,
        created_by_id=entry.created_by_id,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@router.get("", response_model=list[PasswordOut], dependencies=[Depends(require_permissions("passwords.view"))])
def list_passwords(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(PasswordEntry).order_by(PasswordEntry.category, PasswordEntry.title)
    entries = db.exec(stmt).all()
    allowed = []
    for e in entries:
        roles = [r.strip() for r in e.roles_allowed.split(",")]
        if user.role in roles or user.role == UserRole.admin:
            allowed.append(PasswordOut(
                id=e.id,
                title=e.title,
                username=e.username,
                url=e.url,
                notes=e.notes,
                category=e.category,
                roles_allowed=e.roles_allowed,
                created_by_id=e.created_by_id,
                created_at=e.created_at,
                updated_at=e.updated_at,
            ))
    return allowed


@router.get("/{entry_id}", response_model=PasswordOut, dependencies=[Depends(require_permissions("passwords.view"))])
def get_password(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = db.get(PasswordEntry, entry_id)
    if not e:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    roles = [r.strip() for r in e.roles_allowed.split(",")]
    if user.role not in roles and user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="No autorizado")
    return PasswordOut(
        id=e.id,
        title=e.title,
        username=e.username,
        url=e.url,
        notes=e.notes,
        category=e.category,
        roles_allowed=e.roles_allowed,
        created_by_id=e.created_by_id,
        created_at=e.created_at,
        updated_at=e.updated_at,
    )


@router.get("/{entry_id}/reveal", dependencies=[Depends(require_permissions("passwords.reveal"))])
def reveal_password(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = db.get(PasswordEntry, entry_id)
    if not e:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    roles = [r.strip() for r in e.roles_allowed.split(",")]
    if user.role not in roles and user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="No autorizado")
    log_event(db, SessionEventType.password_viewed, user_id=user.id, metadata={"entry_id": e.id, "title": e.title})
    return {"password": decrypt_value(e.password_encrypted)}


@router.delete("/{entry_id}", dependencies=[Depends(require_permissions("passwords.manage"))])
def delete_password(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = db.get(PasswordEntry, entry_id)
    if not e:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    log_event(db, SessionEventType.password_deleted, user_id=user.id, metadata={"entry_id": e.id, "title": e.title})
    db.delete(e)
    db.commit()
    return {"ok": True}

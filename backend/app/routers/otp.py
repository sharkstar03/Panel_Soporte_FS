from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.audit import log_event
from app.crypto import decrypt_value, encrypt_value
from app.deps import get_current_user, get_db, require_permissions
from app.models import OTPEntry, SessionEventType, User, UserRole
from app.schemas import OTPCreateIn, OTPOut, OTPRevealOut

router = APIRouter(prefix="/otp", tags=["otp"])


def _to_out(e: OTPEntry) -> OTPOut:
    return OTPOut(
        id=e.id, title=e.title, issuer=e.issuer, account=e.account,
        algorithm=e.algorithm, digits=e.digits, period=e.period,
        category=e.category, roles_allowed=e.roles_allowed,
        created_by_id=e.created_by_id, created_at=e.created_at,
    )


@router.post("", response_model=OTPOut, dependencies=[Depends(require_permissions("otp.manage"))])
def create_otp(payload: OTPCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    entry = OTPEntry(
        title=payload.title, issuer=payload.issuer, account=payload.account,
        secret_encrypted=encrypt_value(payload.secret.strip().upper()),
        algorithm=payload.algorithm, digits=payload.digits, period=payload.period,
        category=payload.category, roles_allowed=payload.roles_allowed,
        created_by_id=user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    log_event(db, SessionEventType.otp_created, user_id=user.id, metadata={"entry_id": entry.id, "title": entry.title})
    return _to_out(entry)


@router.get("", response_model=list[OTPOut], dependencies=[Depends(require_permissions("otp.view"))])
def list_otp(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    entries = db.exec(select(OTPEntry).order_by(OTPEntry.category, OTPEntry.title)).all()
    return [
        _to_out(e) for e in entries
        if user.role == UserRole.admin or user.role in [r.strip() for r in e.roles_allowed.split(",")]
    ]


@router.get("/{entry_id}/reveal", response_model=OTPRevealOut, dependencies=[Depends(require_permissions("otp.reveal"))])
def reveal_otp(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = db.get(OTPEntry, entry_id)
    if not e:
        raise HTTPException(status_code=404, detail="OTP no encontrado")
    roles = [r.strip() for r in e.roles_allowed.split(",")]
    if user.role not in roles and user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="No autorizado")
    log_event(db, SessionEventType.otp_viewed, user_id=user.id, metadata={"entry_id": e.id})
    return OTPRevealOut(**_to_out(e).model_dump(), secret=decrypt_value(e.secret_encrypted))


@router.delete("/{entry_id}", dependencies=[Depends(require_permissions("otp.manage"))])
def delete_otp(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = db.get(OTPEntry, entry_id)
    if not e:
        raise HTTPException(status_code=404, detail="OTP no encontrado")
    log_event(db, SessionEventType.otp_deleted, user_id=user.id, metadata={"entry_id": e.id, "title": e.title})
    db.delete(e)
    db.commit()
    return {"ok": True}

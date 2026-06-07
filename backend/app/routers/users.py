from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.audit import log_event
from app.deps import get_current_user, get_db, require_permissions
from app.crypto import encrypt_value
from app.models import SessionEventType, User, UserRole, UserSmtpConfig
from app.schemas import SupervisorOut, UserCreateIn, UserOut, UserSmtpOut, UserSmtpUpdateIn
from app.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserOut, dependencies=[Depends(require_permissions("users.manage"))])
def create_user(payload: UserCreateIn, db: Session = Depends(get_db)):
    existing = db.exec(select(User).where(User.username == payload.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ese usuario ya existe")
    user = User(username=payload.username, password_hash=hash_password(payload.password), role=payload.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    log_event(db, SessionEventType.user_created, user_id=user.id, metadata={"username": user.username, "role": user.role})
    return UserOut.model_validate(user, from_attributes=True)


@router.get("", response_model=list[UserOut], dependencies=[Depends(require_permissions("users.manage"))])
def list_users(db: Session = Depends(get_db)):
    users = db.exec(select(User).order_by(User.username)).all()
    return [UserOut.model_validate(u, from_attributes=True) for u in users]


@router.get("/supervisors", response_model=list[SupervisorOut])
def list_supervisors(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    users = db.exec(select(User).where(User.role.in_([UserRole.supervisor, UserRole.admin])).where(User.active == True).order_by(User.username)).all()
    return [SupervisorOut.model_validate(u, from_attributes=True) for u in users]


@router.get("/{user_id}/smtp", response_model=UserSmtpOut, dependencies=[Depends(require_permissions("users.manage"))])
def get_user_smtp(user_id: int, db: Session = Depends(get_db)):
    cfg = db.exec(select(UserSmtpConfig).where(UserSmtpConfig.user_id == user_id)).first()
    if not cfg:
        return UserSmtpOut(
            user_id=user_id,
            smtp_host="",
            smtp_port=587,
            smtp_username="",
            smtp_from_email="",
            smtp_tls=True,
            has_password=False,
        )
    return UserSmtpOut(
        user_id=cfg.user_id,
        smtp_host=cfg.smtp_host,
        smtp_port=cfg.smtp_port,
        smtp_username=cfg.smtp_username,
        smtp_from_email=cfg.smtp_from_email,
        smtp_tls=cfg.smtp_tls,
        has_password=bool(cfg.smtp_password_enc),
    )


@router.put("/{user_id}/smtp", response_model=UserSmtpOut, dependencies=[Depends(require_permissions("users.manage"))])
def update_user_smtp(user_id: int, payload: UserSmtpUpdateIn, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    cfg = db.exec(select(UserSmtpConfig).where(UserSmtpConfig.user_id == user_id)).first()
    if not cfg:
        cfg = UserSmtpConfig(user_id=user_id)

    cfg.smtp_host = payload.smtp_host
    cfg.smtp_port = payload.smtp_port
    cfg.smtp_username = payload.smtp_username
    cfg.smtp_from_email = payload.smtp_from_email
    cfg.smtp_tls = payload.smtp_tls
    if payload.smtp_password is not None:
        cfg.smtp_password_enc = encrypt_value(payload.smtp_password) if payload.smtp_password else ""

    db.add(cfg)
    db.commit()
    db.refresh(cfg)

    return UserSmtpOut(
        user_id=cfg.user_id,
        smtp_host=cfg.smtp_host,
        smtp_port=cfg.smtp_port,
        smtp_username=cfg.smtp_username,
        smtp_from_email=cfg.smtp_from_email,
        smtp_tls=cfg.smtp_tls,
        has_password=bool(cfg.smtp_password_enc),
    )

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.audit import log_event
from app.deps import get_current_user, get_db, get_user_permission_codes
from app.models import Role, SessionEventType, User, UserRoleLink
from app.schemas import LoginIn, TokenOut, UserOut
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.exec(select(User).where(User.username == payload.username)).first()
    if not user or not user.active or not verify_password(payload.password, user.password_hash):
        log_event(db, SessionEventType.login_failed, metadata={"username": payload.username})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    token = create_access_token(user.username)
    log_event(db, SessionEventType.login_success, user_id=user.id)
    return TokenOut(access_token=token)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    roles = db.exec(
        select(Role.name)
        .join(UserRoleLink, UserRoleLink.role_id == Role.id)
        .where(UserRoleLink.user_id == user.id)
        .order_by(Role.name)
    ).all()
    permissions = sorted([p for p in get_user_permission_codes(db, user) if p != "*"])
    return UserOut(
        id=user.id,
        username=user.username,
        role=user.role,
        active=user.active,
        created_at=user.created_at,
        roles=list(roles),
        permissions=permissions,
    )

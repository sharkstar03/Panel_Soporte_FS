import time
from collections import defaultdict
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select

from app.audit import log_event
from app.deps import get_current_user, get_db, get_user_permission_codes
from app.models import Role, SessionEventType, User, UserRoleLink
from app.schemas import ChangePasswordIn, LoginIn, TokenOut, UserOut
from app.security import create_access_token, hash_password, password_policy_errors, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Rate limiting en memoria para mitigar fuerza bruta de credenciales.
# Ventana deslizante por IP. (En despliegues multi-worker conviene además un
# limitador compartido tipo Redis / proxy inverso.)
_LOGIN_WINDOW_SECONDS = 300
_LOGIN_MAX_ATTEMPTS = 10
_login_attempts: dict[str, list[float]] = defaultdict(list)
_login_lock = Lock()


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_login_rate(ip: str) -> None:
    now = time.monotonic()
    with _login_lock:
        attempts = [t for t in _login_attempts[ip] if now - t < _LOGIN_WINDOW_SECONDS]
        if len(attempts) >= _LOGIN_MAX_ATTEMPTS:
            _login_attempts[ip] = attempts
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.",
            )
        attempts.append(now)
        _login_attempts[ip] = attempts


def _reset_login_rate(ip: str) -> None:
    with _login_lock:
        _login_attempts.pop(ip, None)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    ip = _client_ip(request)
    _check_login_rate(ip)
    user = db.exec(select(User).where(User.username == payload.username)).first()
    if not user or not user.active or not verify_password(payload.password, user.password_hash):
        log_event(db, SessionEventType.login_failed, metadata={"username": payload.username})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    _reset_login_rate(ip)
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


@router.post("/change-password")
def change_password(
    payload: ChangePasswordIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")
    errors = password_policy_errors(payload.new_password)
    if errors:
        raise HTTPException(status_code=422, detail="Contraseña insegura: " + " ".join(errors))
    if verify_password(payload.new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="La nueva contraseña debe ser distinta de la actual")
    user.password_hash = hash_password(payload.new_password)
    db.add(user)
    db.commit()
    log_event(db, SessionEventType.user_password_changed, user_id=user.id,
              metadata={"target_user_id": user.id, "by": "self"})
    return {"ok": True}

import time
import uuid
from collections import defaultdict
from pathlib import Path
from threading import Lock

import filetype
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlmodel import Session, select

from app.audit import log_event
from app.config import settings
from app.deps import get_current_user, get_db, get_user_permission_codes
from app.files import read_upload
from app.models import Role, SessionEventType, User, UserRoleLink
from app.s3 import s3_client
from app.schemas import ChangePasswordIn, LoginIn, ProfileUpdateIn, TokenOut, UserOut
from app.security import create_access_token, hash_password, password_policy_errors, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

_LOCAL_STORAGE_DIR = Path(__file__).resolve().parents[2] / "storage"

# Rate limiting en memoria para mitigar fuerza bruta de credenciales.
# Se aplican DOS límites por ventana deslizante:
#   - por usuario  → protege una cuenta concreta sin depender de la IP
#                    (robusto frente a rotación/spoofing de IP de origen).
#   - por IP       → frena a un único origen.
# (En despliegues multi-worker conviene además un limitador compartido tipo Redis.)
_LOGIN_WINDOW_SECONDS = 300
_LOGIN_MAX_PER_USER = 10
_LOGIN_MAX_PER_IP = 50
_login_attempts: dict[str, list[float]] = defaultdict(list)
_login_lock = Lock()


def _client_ip(request: Request) -> str:
    # X-Real-IP lo fija el proxy de confianza (nginx) y sobrescribe cualquier
    # valor del cliente, por lo que NO es spoofeable a través de la app.
    # NO se confía en X-Forwarded-For (lo controla el cliente).
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else "unknown"


def _rate_limits(ip: str, username: str) -> list[tuple[str, int]]:
    return [
        (f"user:{username.strip().lower()}", _LOGIN_MAX_PER_USER),
        (f"ip:{ip}", _LOGIN_MAX_PER_IP),
    ]


def _check_login_rate(limits: list[tuple[str, int]]) -> None:
    now = time.monotonic()
    with _login_lock:
        # Primero verificamos todos los cupos; si alguno se excede, 429.
        for key, maximum in limits:
            recent = [t for t in _login_attempts[key] if now - t < _LOGIN_WINDOW_SECONDS]
            _login_attempts[key] = recent
            if len(recent) >= maximum:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.",
                )
        # Registramos el intento en cada cupo.
        for key, _ in limits:
            _login_attempts[key].append(now)


def _reset_login_rate(limits: list[tuple[str, int]]) -> None:
    with _login_lock:
        for key, _ in limits:
            _login_attempts.pop(key, None)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    limits = _rate_limits(_client_ip(request), payload.username)
    _check_login_rate(limits)
    user = db.exec(select(User).where(User.username == payload.username)).first()
    if not user or not user.active or not verify_password(payload.password, user.password_hash):
        log_event(db, SessionEventType.login_failed, metadata={"username": payload.username})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    _reset_login_rate(limits)
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
        email=user.email,
        email_verified=user.email_verified,
        display_name=user.display_name,
        avatar_key=user.avatar_key,
        birthday=user.birthday,
        theme=user.theme,
    )


@router.put("/profile", response_model=UserOut)
def update_profile(
    payload: ProfileUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    changes: dict = {}

    if payload.display_name is not None and payload.display_name != user.display_name:
        user.display_name = payload.display_name
        changes["display_name"] = payload.display_name

    if payload.birthday is not None and payload.birthday != user.birthday:
        user.birthday = payload.birthday
        changes["birthday"] = str(payload.birthday)

    if payload.theme is not None and payload.theme != user.theme:
        user.theme = payload.theme
        changes["theme"] = payload.theme

    if payload.email is not None and payload.email != user.email:
        existing = db.exec(select(User).where(User.email == payload.email, User.id != user.id)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ese correo ya está en uso")
        user.email = payload.email
        user.email_verified = False
        changes["email"] = payload.email

    if changes:
        db.add(user)
        db.commit()
        db.refresh(user)
        log_event(db, SessionEventType.user_profile_updated, user_id=user.id,
                  metadata={"target_user_id": user.id, **changes})

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
        email=user.email,
        email_verified=user.email_verified,
        display_name=user.display_name,
        avatar_key=user.avatar_key,
        birthday=user.birthday,
        theme=user.theme,
    )


@router.post("/avatar", response_model=UserOut)
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = read_upload(file)

    kind = filetype.guess(data)
    mime = kind.mime if kind else (file.content_type or "")
    if not mime.lower().startswith("image/"):
        raise HTTPException(status_code=415, detail="El avatar debe ser una imagen")

    ext = f".{kind.extension}" if kind else ""
    old_key = user.avatar_key
    storage_key = f"avatars/{user.id}_{uuid.uuid4().hex}{ext}"

    client = s3_client()
    if client:
        client.put_object(
            Bucket=settings.s3_bucket,
            Key=storage_key,
            Body=data,
            ContentType=mime,
        )
        if old_key:
            try:
                client.delete_object(Bucket=settings.s3_bucket, Key=old_key)
            except Exception:
                pass
    else:
        out_path = (_LOCAL_STORAGE_DIR / storage_key).resolve()
        storage_root = _LOCAL_STORAGE_DIR.resolve()
        if not str(out_path).startswith(str(storage_root)):
            raise HTTPException(status_code=500, detail="Ruta de almacenamiento inválida")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(data)
        if old_key:
            old_path = (_LOCAL_STORAGE_DIR / old_key).resolve()
            if str(old_path).startswith(str(storage_root)) and old_path.exists():
                old_path.unlink()

    user.avatar_key = storage_key
    db.add(user)
    db.commit()
    db.refresh(user)
    log_event(db, SessionEventType.user_avatar_updated, user_id=user.id, metadata={"target_user_id": user.id})

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
        email=user.email,
        email_verified=user.email_verified,
        display_name=user.display_name,
        avatar_key=user.avatar_key,
        birthday=user.birthday,
        theme=user.theme,
    )


@router.get("/avatar/{user_id}")
def get_avatar(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    target = db.get(User, user_id)
    if not target or not target.avatar_key:
        raise HTTPException(status_code=404, detail="Avatar no encontrado")

    client = s3_client()
    if client:
        obj = client.get_object(Bucket=settings.s3_bucket, Key=target.avatar_key)
        data = obj["Body"].read()
    else:
        in_path = (_LOCAL_STORAGE_DIR / target.avatar_key).resolve()
        storage_root = _LOCAL_STORAGE_DIR.resolve()
        if not str(in_path).startswith(str(storage_root)) or not in_path.exists():
            raise HTTPException(status_code=404, detail="Avatar no encontrado")
        data = in_path.read_bytes()

    kind = filetype.guess(data)
    mime = kind.mime if kind else "application/octet-stream"
    return Response(content=data, media_type=mime)


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

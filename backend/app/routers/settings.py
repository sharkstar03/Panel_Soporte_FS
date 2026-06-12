from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.audit import log_event
from app.deps import get_current_user, get_db, require_permissions
from app.models import SessionEventType, SystemSetting, User
from app.schemas import SettingOut, SettingUpdateIn
from app.settings_helper import (
    get_session_min_reason_length,
    get_session_min_summary_length,
    get_setting,
    set_setting,
)

router = APIRouter(prefix="/settings", tags=["settings"])

# Únicas claves que pueden leerse SIN autenticación. Todo lo demás (SMTP,
# CORS, expiración de tokens, etc.) queda restringido a settings.manage.
PUBLIC_SETTING_KEYS = {"app_name"}


@router.get("/public/session-config")
def get_public_session_config(db: Session = Depends(get_db)):
    """Configuración pública del módulo de sesiones (usada por el formulario
    de nueva sesión antes de autenticar, o para mantener UI sincronizada).
    """
    return {
        "session_min_reason_length": get_session_min_reason_length(db),
        "session_min_summary_length": get_session_min_summary_length(db),
    }


@router.get("", response_model=list[SettingOut], dependencies=[Depends(require_permissions("settings.manage"))])
def list_settings(db: Session = Depends(get_db)):
    settings = db.exec(select(SystemSetting).order_by(SystemSetting.category, SystemSetting.key)).all()
    return [SettingOut.model_validate(s, from_attributes=True) for s in settings]


@router.get("/{key}", response_model=SettingOut, dependencies=[Depends(require_permissions("settings.manage"))])
def get_setting_by_key(key: str, db: Session = Depends(get_db)):
    s = db.exec(select(SystemSetting).where(SystemSetting.key == key)).first()
    if not s:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return SettingOut.model_validate(s, from_attributes=True)


@router.put("/{key}", response_model=SettingOut, dependencies=[Depends(require_permissions("settings.manage"))])
def update_setting(
    key: str,
    payload: SettingUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = db.exec(select(SystemSetting).where(SystemSetting.key == key)).first()
    if not s:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")

    updated = set_setting(
        db,
        key=key,
        value=payload.value,
        description=s.description,
        category=s.category,
        updated_by_id=user.id,
    )

    log_event(
        db,
        SessionEventType.setting_updated,
        user_id=user.id,
        metadata={"setting_key": key, "old_value": s.value, "new_value": updated.value},
    )

    return SettingOut.model_validate(updated, from_attributes=True)


@router.get("/public/{key}")
def get_public_setting(key: str, db: Session = Depends(get_db)):
    """Endpoint público SOLO para settings explícitamente marcados como públicos.

    Se valida contra una lista blanca para evitar la fuga de configuraciones
    sensibles (credenciales SMTP, CORS, etc.) a usuarios no autenticados.
    """
    if key not in PUBLIC_SETTING_KEYS:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    s = db.exec(select(SystemSetting).where(SystemSetting.key == key)).first()
    if not s:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return {"key": s.key, "value": get_setting(db, key)}

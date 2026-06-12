from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from app.crypto import decrypt_value, encrypt_value
from app.deps import get_current_user, get_db, require_permissions
from app.models import FiscalConfig, User
from app.placeft.scraper import get_cached_scraper, reset_cached_scraper
from app.placeft.storage import (
    load_diagnostic_options,
    load_mappings,
    save_diagnostic_options,
    save_mappings,
)

router = APIRouter(prefix="/printers", tags=["printers"])

DEFAULT_TAXPAYER_ID = "3306b757-a1d9-4981-acef-12f4275098d0"

# Campos que se pueden limpiar de forma masiva.
CLEARABLE_FIELDS = {
    "estadoInterno": {"estadoInterno", "estado_interno"},
    "zNota": {"zNota", "z_nota"},
    "alertaNota": {"alertaNota", "alerta_nota"},
    "manualDiagnosis": {"manualDiagnosis", "manual_diagnosis"},
}


# ── Helpers ──────────────────────────────────────────────────────────────────
def _get_dgi_creds(db: Session) -> tuple[str, str, str]:
    cfg = db.get(FiscalConfig, 1)
    if not cfg or not cfg.username or not cfg.password_enc:
        return "", "", ""
    try:
        pwd = decrypt_value(cfg.password_enc)
    except Exception:
        pwd = ""
    return cfg.username, pwd, (cfg.taxpayer_id or "").strip()


def _require_creds(db: Session) -> tuple[str, str, str]:
    username, password, taxpayer = _get_dgi_creds(db)
    if not username or not password:
        raise HTTPException(
            status_code=400,
            detail="Credenciales DGI no configuradas. Ve a Impresoras Fiscales → Configuración DGI.",
        )
    return username, password, taxpayer


def format_datez(value: str) -> str:
    try:
        s = str(value).strip()
        if not s:
            return ""
        if len(s) == 8 and s.isdigit():
            return f"{s[6:8]}-{s[4:6]}-{s[0:4]}"
        if "T" in s:
            try:
                return datetime.fromisoformat(s).strftime("%d-%m-%Y")
            except Exception:
                pass
        if "-" in s and len(s) == 10:
            parts = s.split("-")
            if len(parts[0]) == 4:
                return f"{parts[2]}-{parts[1]}-{parts[0]}"
        if len(s) == 6 and s.isdigit():
            try:
                return datetime.strptime(s, "%y%m%d").strftime("%d-%m-%Y")
            except Exception:
                pass
        return s
    except Exception:
        return str(value)


# ── Equipos (en vivo desde la DGI) ───────────────────────────────────────────
@router.get("/equipos", dependencies=[Depends(require_permissions("printers.view"))])
def get_equipos(db: Session = Depends(get_db)):
    username, password, taxpayer = _require_creds(db)
    default_tax = taxpayer or DEFAULT_TAXPAYER_ID

    scraper, ok, msg = get_cached_scraper(username, password)
    if not ok:
        raise HTTPException(status_code=502, detail=f"No se pudo autenticar con la DGI: {msg}")

    equipos, error = scraper.get_equipos()
    if equipos is None:
        msg0 = (error or "").lower()
        if "sesión expirada" in msg0 or "token expirado" in msg0 or "token inválido" in msg0:
            reset_cached_scraper(username)
            scraper2, ok2, _ = get_cached_scraper(username, password)
            if ok2:
                equipos, error = scraper2.get_equipos()

    if equipos is not None:
        for e in equipos:
            if isinstance(e, dict):
                e["serie"] = str(e.get("serie") or "").strip().upper()
                if not str(e.get("taxpayerId") or "").strip():
                    e["taxpayerId"] = default_tax
        return {
            "success": True,
            "equipos": equipos,
            "total": len(equipos),
            "taxpayerId": default_tax,
            "timestamp": datetime.now().isoformat(),
        }

    msg = (error or "").lower()
    code = 503 if ("dns" in msg or "resolve" in msg or "conectar" in msg or "api de placeft" in msg) else 502
    raise HTTPException(status_code=code, detail=error or "Error obteniendo equipos")


class ZReportIn(BaseModel):
    serial: str
    days: int = 30
    machineId: Optional[str] = None
    taxpayerId: Optional[str] = None
    transmission: Optional[str] = None


@router.post("/zreport", dependencies=[Depends(require_permissions("printers.view"))])
def printer_zreport(payload: ZReportIn, db: Session = Depends(get_db)):
    serial = (payload.serial or "").strip()
    if not serial:
        raise HTTPException(status_code=400, detail="serial requerido")
    username, password, taxpayer = _require_creds(db)

    scraper, ok, msg = get_cached_scraper(username, password)
    if not ok:
        raise HTTPException(status_code=502, detail=f"No se pudo autenticar con la DGI: {msg}")

    machine_id = (payload.machineId or "").strip() or None
    taxpayer_id = (payload.taxpayerId or "").strip() or None
    if not machine_id or not taxpayer_id:
        mid, tid = scraper.resolve_machine_ids(serial)
        machine_id = machine_id or mid
        taxpayer_id = taxpayer_id or tid
    taxpayer_id = taxpayer_id or taxpayer or DEFAULT_TAXPAYER_ID

    if not machine_id:
        cached = scraper.get_cached_z(serial)
        if cached and cached.get("numz"):
            return {
                "success": True,
                "z_number": cached.get("numz"),
                "z_date": format_datez(cached.get("datez") or ""),
                "cached": True,
                "cached_at": cached.get("updatedAt") or "",
                "raw": {"message": "Falta machineId para consultar Reporte Z"},
            }
        return {"success": False, "raw": {"message": "Falta machineId para consultar Reporte Z"}}

    okz, item = scraper.z_report(
        serial, days=payload.days, machine_id=machine_id, taxpayer_id=taxpayer_id, transmission=payload.transmission
    )
    if not okz:
        msg0 = str(item.get("message") or item.get("raw", {}).get("message") or item.get("error") or "").lower()
        if "sesión expirada" in msg0 or "token expirado" in msg0 or "sin token" in msg0:
            reset_cached_scraper(username)
            scraper2, ok2, _ = get_cached_scraper(username, password)
            if ok2:
                okz, item = scraper2.z_report(
                    serial, days=payload.days, machine_id=machine_id, taxpayer_id=taxpayer_id, transmission=payload.transmission
                )

    if not okz:
        cached = scraper.get_cached_z(serial)
        if cached and cached.get("numz"):
            return {
                "success": True,
                "z_number": cached.get("numz"),
                "z_date": format_datez(cached.get("datez") or ""),
                "cached": True,
                "cached_at": cached.get("updatedAt") or "",
                "raw": item,
            }
        return {"success": False, "raw": item}

    znum = item.get("numz") or item.get("Numz") or item.get("zNumber") or item.get("number")
    datez = item.get("datez") or item.get("Datez") or item.get("zDate")
    return {"success": True, "z_number": znum, "z_date": format_datez(datez), "raw": item}


# ── Mapeos internos ──────────────────────────────────────────────────────────
@router.get("/mappings", dependencies=[Depends(require_permissions("printers.view"))])
def get_mappings():
    data = load_mappings()
    items = [{"serie": k, **v} for k, v in data.items()]
    return {"success": True, "mappings": items}


class MappingsIn(BaseModel):
    mappings: Optional[list[dict[str, Any]]] = None
    serie: Optional[str] = None

    class Config:
        extra = "allow"


@router.post("/mappings", dependencies=[Depends(require_permissions("printers.manage"))])
def upsert_mappings(payload: dict[str, Any]):
    if isinstance(payload, dict) and "mappings" in payload:
        incoming = payload.get("mappings") or []
    elif isinstance(payload, list):
        incoming = payload
    elif isinstance(payload, dict) and "serie" in payload:
        incoming = [payload]
    else:
        raise HTTPException(status_code=400, detail="Formato inválido")

    stored = load_mappings()
    updated = 0
    for item in incoming:
        serie = (item.get("serie") or "").strip()
        if not serie:
            continue
        current = stored.get(serie, {})

        def update_field(keys, storage_key):
            found_key = next((k for k in keys if k in item), None)
            if found_key:
                val = (item[found_key] or "").strip()
                if val:
                    current[storage_key] = val
                else:
                    current.pop(storage_key, None)

        update_field(["sucursal"], "sucursal")
        update_field(["caja"], "caja")
        update_field(["sistema"], "sistema")
        update_field(["detalle"], "detalle")
        update_field(["zNota", "z_nota"], "zNota")
        update_field(["estadoInterno", "estado_interno"], "estadoInterno")
        update_field(["mantenimientoUltimo", "mantenimiento_ultimo"], "mantenimientoUltimo")
        update_field(["mantenimientoProximo", "mantenimiento_proximo"], "mantenimientoProximo")
        update_field(["alertaNota", "alerta_nota"], "alertaNota")
        update_field(["manualDiagnosis", "manual_diagnosis"], "manualDiagnosis")
        update_field(["anydeskId", "anydesk_id"], "anydeskId")
        update_field(["anydeskPassword", "anydesk_password"], "anydeskPassword")

        # Activo vinculado (entero o vacío para desvincular).
        if "assetId" in item or "asset_id" in item:
            raw = item.get("assetId", item.get("asset_id"))
            sval = str(raw).strip() if raw is not None else ""
            if sval and sval != "0":
                current["assetId"] = sval
            else:
                current.pop("assetId", None)

        stored[serie] = current
        updated += 1
    save_mappings(stored)
    return {"success": True, "updated": updated}


class ClearFieldsIn(BaseModel):
    fields: Optional[list[str]] = None


@router.post("/mappings/clear", dependencies=[Depends(require_permissions("printers.manage"))])
def clear_mappings_fields(payload: ClearFieldsIn):
    requested = payload.fields
    if not isinstance(requested, list) or not requested:
        requested = list(CLEARABLE_FIELDS.keys())

    fields_to_clear: set[str] = set()
    for raw in requested:
        key = (str(raw) or "").strip()
        for canonical, aliases in CLEARABLE_FIELDS.items():
            if key == canonical or key in aliases:
                fields_to_clear.add(canonical)
                break

    if not fields_to_clear:
        raise HTTPException(status_code=400, detail="No se reconoció ningún campo válido para limpiar.")

    stored = load_mappings()
    cleared_series = 0
    for serie, current in stored.items():
        if not isinstance(current, dict):
            continue
        touched = False
        for field in fields_to_clear:
            if current.get(field):
                current.pop(field, None)
                touched = True
        if touched:
            cleared_series += 1

    save_mappings(stored)
    return {"success": True, "clearedSeries": cleared_series, "fields": sorted(fields_to_clear)}


# ── Diagnósticos ─────────────────────────────────────────────────────────────
@router.get("/diagnostics", dependencies=[Depends(require_permissions("printers.view"))])
def get_diagnostics():
    return {"success": True, "options": load_diagnostic_options()}


class DiagnosticsIn(BaseModel):
    options: list[str]


@router.post("/diagnostics", dependencies=[Depends(require_permissions("printers.manage"))])
def save_diagnostics(payload: DiagnosticsIn):
    clean = sorted({str(o).strip() for o in payload.options if str(o).strip()})
    save_diagnostic_options(clean)
    return {"success": True, "options": clean}


# ── Configuración de credenciales DGI ────────────────────────────────────────
class DgiConfigOut(BaseModel):
    username: str
    taxpayer_id: str
    has_password: bool
    updated_at: Optional[datetime] = None


class DgiConfigIn(BaseModel):
    username: str
    password: Optional[str] = None  # None/"" = no cambiar
    taxpayer_id: Optional[str] = ""


@router.get("/config", response_model=DgiConfigOut, dependencies=[Depends(require_permissions("printers.manage"))])
def get_config(db: Session = Depends(get_db)):
    cfg = db.get(FiscalConfig, 1)
    if not cfg:
        return DgiConfigOut(username="", taxpayer_id="", has_password=False)
    return DgiConfigOut(
        username=cfg.username or "",
        taxpayer_id=cfg.taxpayer_id or "",
        has_password=bool(cfg.password_enc),
        updated_at=cfg.updated_at,
    )


@router.put("/config", response_model=DgiConfigOut, dependencies=[Depends(require_permissions("printers.manage"))])
def update_config(payload: DgiConfigIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cfg = db.get(FiscalConfig, 1)
    if not cfg:
        cfg = FiscalConfig(id=1)
    old_username = cfg.username
    cfg.username = (payload.username or "").strip()
    cfg.taxpayer_id = (payload.taxpayer_id or "").strip()
    if payload.password:
        cfg.password_enc = encrypt_value(payload.password)
    cfg.updated_at = datetime.utcnow()
    cfg.updated_by_id = user.id
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    # Invalida tokens cacheados (credenciales cambiaron).
    if old_username:
        reset_cached_scraper(old_username)
    reset_cached_scraper(cfg.username)
    return DgiConfigOut(
        username=cfg.username,
        taxpayer_id=cfg.taxpayer_id or "",
        has_password=bool(cfg.password_enc),
        updated_at=cfg.updated_at,
    )


@router.post("/config/test", dependencies=[Depends(require_permissions("printers.manage"))])
def test_config(db: Session = Depends(get_db)):
    username, password, _ = _require_creds(db)
    reset_cached_scraper(username)
    _, ok, msg = get_cached_scraper(username, password)
    if not ok:
        raise HTTPException(status_code=502, detail=msg or "No se pudo autenticar con la DGI")
    return {"success": True, "message": "Conexión con la DGI exitosa"}

"""Capa de persistencia de la integración de impresoras fiscales.

Reemplaza el almacenamiento basado en JSON del proyecto original por la base de
datos del panel (SQLModel), conservando exactamente la misma forma de los datos
(dicts con claves camelCase) para que el scraper funcione sin cambios.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict

from sqlmodel import Session, delete, select

from app.crypto import decrypt_value, encrypt_value
from app.db import engine
from app.models import (
    FiscalDiagnosticOption,
    FiscalMachineIndex,
    FiscalMapping,
    FiscalZCache,
)

# Mapeo columna_db -> clave camelCase usada por el scraper / frontend.
_MAPPING_FIELDS: list[tuple[str, str]] = [
    ("sucursal", "sucursal"),
    ("caja", "caja"),
    ("sistema", "sistema"),
    ("detalle", "detalle"),
    ("z_nota", "zNota"),
    ("estado_interno", "estadoInterno"),
    ("anydesk_id", "anydeskId"),
    ("anydesk_password", "anydeskPassword"),
    ("mantenimiento_ultimo", "mantenimientoUltimo"),
    ("mantenimiento_proximo", "mantenimientoProximo"),
    ("alerta_nota", "alertaNota"),
    ("manual_diagnosis", "manualDiagnosis"),
]


def load_mappings() -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    with Session(engine) as db:
        rows = db.exec(select(FiscalMapping)).all()
        for r in rows:
            serie = (r.serie or "").strip()
            if not serie:
                continue
            item: Dict[str, Any] = {}
            for col, key in _MAPPING_FIELDS:
                v = getattr(r, col, None)
                if v is None:
                    continue
                v2 = str(v).strip()
                if v2:
                    # Descifrar credenciales sensibles al exponerlas al scraper/frontend.
                    if col == "anydesk_password" and v2.startswith("gAAAA"):
                        try:
                            v2 = decrypt_value(v2)
                        except Exception:
                            pass
                    item[key] = v2
            if r.asset_id is not None:
                item["assetId"] = r.asset_id
            if r.imagenes:
                try:
                    parsed = json.loads(r.imagenes)
                    if isinstance(parsed, list) and parsed:
                        item["imagenes"] = parsed
                except Exception:
                    pass
            out[serie] = item
    return out


def save_mappings(mappings: Dict[str, Dict[str, Any]]) -> None:
    with Session(engine) as db:
        for serie, v in (mappings or {}).items():
            s = (serie or "").strip()
            if not s:
                continue
            row = db.get(FiscalMapping, s)
            if not v:
                if row:
                    db.delete(row)
                continue
            if not row:
                row = FiscalMapping(serie=s)
            row.sucursal = (v.get("sucursal") or "").strip() or None
            row.caja = (v.get("caja") or "").strip() or None
            row.sistema = (v.get("sistema") or "").strip() or None
            row.detalle = (v.get("detalle") or "").strip() or None
            row.z_nota = (v.get("zNota") or "").strip() or None
            row.estado_interno = (v.get("estadoInterno") or "").strip() or None
            row.anydesk_id = (v.get("anydeskId") or "").strip() or None
            pwd = (v.get("anydeskPassword") or "").strip() or None
            if pwd and not pwd.startswith("gAAAA"):
                pwd = encrypt_value(pwd)
            row.anydesk_password = pwd
            row.mantenimiento_ultimo = (v.get("mantenimientoUltimo") or "").strip() or None
            row.mantenimiento_proximo = (v.get("mantenimientoProximo") or "").strip() or None
            row.alerta_nota = (v.get("alertaNota") or "").strip() or None
            row.manual_diagnosis = (v.get("manualDiagnosis") or "").strip() or None
            aid = v.get("assetId")
            try:
                row.asset_id = int(aid) if aid not in (None, "", 0, "0") else None
            except (TypeError, ValueError):
                row.asset_id = None
            imgs = v.get("imagenes")
            row.imagenes = json.dumps(imgs, ensure_ascii=False) if isinstance(imgs, list) and imgs else None
            row.updated_at = datetime.utcnow()
            db.add(row)
        db.commit()


def load_machine_index() -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    with Session(engine) as db:
        for r in db.exec(select(FiscalMachineIndex)).all():
            serie = (r.serie or "").strip()
            if not serie:
                continue
            item: Dict[str, Any] = {}
            if (r.machine_id or "").strip():
                item["machineId"] = r.machine_id.strip()
            if (r.taxpayer_id or "").strip():
                item["taxpayerId"] = r.taxpayer_id.strip()
            out[serie] = item
    return out


def save_machine_index(index: Dict[str, Dict[str, Any]]) -> None:
    with Session(engine) as db:
        for serie, v in (index or {}).items():
            s = (serie or "").strip()
            if not s:
                continue
            row = db.get(FiscalMachineIndex, s)
            if not row:
                row = FiscalMachineIndex(serie=s)
            row.machine_id = (v.get("machineId") or "").strip() or None
            row.taxpayer_id = (v.get("taxpayerId") or "").strip() or None
            row.updated_at = datetime.utcnow()
            db.add(row)
        db.commit()


def load_zcache() -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    with Session(engine) as db:
        for r in db.exec(select(FiscalZCache)).all():
            serie = (r.serie or "").strip()
            if not serie:
                continue
            item: Dict[str, Any] = {}
            if r.datez is not None:
                item["datez"] = str(r.datez)
            if r.numz is not None:
                item["numz"] = str(r.numz)
            if r.transmission_date is not None:
                item["transmissionDate"] = str(r.transmission_date)
            if r.updated_at is not None:
                item["updatedAt"] = r.updated_at.isoformat() if isinstance(r.updated_at, datetime) else str(r.updated_at)
            out[serie] = item
    return out


def save_zcache(cache: Dict[str, Dict[str, Any]]) -> None:
    with Session(engine) as db:
        for serie, v in (cache or {}).items():
            s = (serie or "").strip()
            if not s:
                continue
            row = db.get(FiscalZCache, s)
            if not row:
                row = FiscalZCache(serie=s)
            row.datez = (v.get("datez") or "").strip() or None
            row.numz = (v.get("numz") or "").strip() or None
            row.transmission_date = (v.get("transmissionDate") or "").strip() or None
            row.updated_at = datetime.utcnow()
            db.add(row)
        db.commit()


def load_diagnostic_options() -> list[str]:
    with Session(engine) as db:
        rows = db.exec(select(FiscalDiagnosticOption).order_by(FiscalDiagnosticOption.option)).all()
    return [r.option for r in rows if (r.option or "").strip()]


def save_diagnostic_options(options: list[str]) -> None:
    clean = sorted({str(o).strip() for o in (options or []) if str(o).strip()})
    with Session(engine) as db:
        db.exec(delete(FiscalDiagnosticOption))
        for opt in clean:
            db.add(FiscalDiagnosticOption(option=opt))
        db.commit()

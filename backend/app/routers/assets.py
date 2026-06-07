from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.audit import log_event
from app.deps import get_current_user, get_db, require_permissions
from app.crypto import decrypt_value, encrypt_value
from app.models import Asset, SessionEventType, User
from app.schemas import AssetCreateIn, AssetOut

router = APIRouter(prefix="/assets", tags=["assets"])

def _mask_asset(a: Asset) -> AssetOut:
    out = AssetOut.model_validate(a, from_attributes=True)
    return out.model_copy(update={
        "anydesk_password": None,
        "rustdesk_password": None,
        "teamviewer_password": None,
    })


def _decrypt_if_encrypted(value: str | None) -> str | None:
    if not value:
        return None
    if value.startswith("gAAAA"):
        return decrypt_value(value)
    return value



@router.post("", response_model=AssetOut, dependencies=[Depends(require_permissions("assets.manage"))])
def create_asset(payload: AssetCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    data = payload.model_dump()
    if data.get("anydesk_password") is not None:
        data["anydesk_password"] = encrypt_value(data["anydesk_password"]) if data["anydesk_password"] else None
    if data.get("rustdesk_password") is not None:
        data["rustdesk_password"] = encrypt_value(data["rustdesk_password"]) if data["rustdesk_password"] else None
    if data.get("teamviewer_password") is not None:
        data["teamviewer_password"] = encrypt_value(data["teamviewer_password"]) if data["teamviewer_password"] else None

    asset = Asset(**data)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    log_event(db, SessionEventType.asset_created, user_id=user.id, metadata={"asset_id": asset.id, "name": asset.name})
    return _mask_asset(asset)


@router.get("", response_model=list[AssetOut], dependencies=[Depends(require_permissions("assets.view"))])
def list_assets(q: str | None = None, branch_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(Asset).order_by(Asset.name)
    if branch_id:
        stmt = stmt.where(Asset.branch_id == branch_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (Asset.name.ilike(like))
            | (Asset.hostname.ilike(like))
            | (Asset.ip.ilike(like))
            | (Asset.anydesk_id.ilike(like))
            | (Asset.rustdesk_id.ilike(like))
            | (Asset.teamviewer_id.ilike(like))
            | (Asset.vnc_host.ilike(like))
        )
    assets = db.exec(stmt).all()
    return [_mask_asset(a) for a in assets]


@router.get("/{asset_id}", response_model=AssetOut, dependencies=[Depends(require_permissions("assets.view"))])
def get_asset(asset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    return _mask_asset(asset)


@router.get("/{asset_id}/remote-secrets", dependencies=[Depends(require_permissions("assets.reveal"))])
def reveal_remote_secrets(asset_id: int, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")

    changed = False
    anydesk = _decrypt_if_encrypted(asset.anydesk_password)
    if asset.anydesk_password and not asset.anydesk_password.startswith("gAAAA"):
        asset.anydesk_password = encrypt_value(asset.anydesk_password)
        changed = True

    rustdesk = _decrypt_if_encrypted(asset.rustdesk_password)
    if asset.rustdesk_password and not asset.rustdesk_password.startswith("gAAAA"):
        asset.rustdesk_password = encrypt_value(asset.rustdesk_password)
        changed = True

    teamviewer = _decrypt_if_encrypted(asset.teamviewer_password)
    if asset.teamviewer_password and not asset.teamviewer_password.startswith("gAAAA"):
        asset.teamviewer_password = encrypt_value(asset.teamviewer_password)
        changed = True

    if changed:
        db.add(asset)
        db.commit()

    return {
        "anydesk_password": anydesk,
        "rustdesk_password": rustdesk,
        "teamviewer_password": teamviewer,
    }


@router.put("/{asset_id}", response_model=AssetOut, dependencies=[Depends(require_permissions("assets.manage"))])
def update_asset(asset_id: int, payload: AssetCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    incoming = payload.model_dump(exclude_unset=True)
    if "anydesk_password" in incoming:
        incoming["anydesk_password"] = encrypt_value(incoming["anydesk_password"]) if incoming["anydesk_password"] else None
    if "rustdesk_password" in incoming:
        incoming["rustdesk_password"] = encrypt_value(incoming["rustdesk_password"]) if incoming["rustdesk_password"] else None
    if "teamviewer_password" in incoming:
        incoming["teamviewer_password"] = encrypt_value(incoming["teamviewer_password"]) if incoming["teamviewer_password"] else None

    for key, value in incoming.items():
        setattr(asset, key, value)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    log_event(db, SessionEventType.asset_updated, user_id=user.id, metadata={"asset_id": asset.id, "name": asset.name})
    return _mask_asset(asset)


@router.delete("/{asset_id}", dependencies=[Depends(require_permissions("assets.manage"))])
def delete_asset(asset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    log_event(db, SessionEventType.asset_deleted, user_id=user.id, metadata={"asset_id": asset.id, "name": asset.name})
    db.delete(asset)
    db.commit()
    return {"ok": True}

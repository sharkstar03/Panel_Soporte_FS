from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.audit import log_event
from app.deps import get_current_user, get_db, require_permissions
from app.models import Asset, SessionEventType, User
from app.schemas import AssetCreateIn, AssetOut

router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("", response_model=AssetOut, dependencies=[Depends(require_permissions("assets.manage"))])
def create_asset(payload: AssetCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = Asset(**payload.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    log_event(db, SessionEventType.asset_created, user_id=user.id, metadata={"asset_id": asset.id, "name": asset.name})
    return AssetOut.model_validate(asset, from_attributes=True)


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
    return [AssetOut.model_validate(a, from_attributes=True) for a in assets]


@router.get("/{asset_id}", response_model=AssetOut, dependencies=[Depends(require_permissions("assets.view"))])
def get_asset(asset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    return AssetOut.model_validate(asset, from_attributes=True)


@router.put("/{asset_id}", response_model=AssetOut, dependencies=[Depends(require_permissions("assets.manage"))])
def update_asset(asset_id: int, payload: AssetCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(asset, key, value)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    log_event(db, SessionEventType.asset_updated, user_id=user.id, metadata={"asset_id": asset.id, "name": asset.name})
    return AssetOut.model_validate(asset, from_attributes=True)


@router.delete("/{asset_id}", dependencies=[Depends(require_permissions("assets.manage"))])
def delete_asset(asset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    log_event(db, SessionEventType.asset_deleted, user_id=user.id, metadata={"asset_id": asset.id, "name": asset.name})
    db.delete(asset)
    db.commit()
    return {"ok": True}

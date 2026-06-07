from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.deps import get_db, get_current_user, require_permissions
from app.models import Branch, User
from app.schemas import BranchCreateIn, BranchOut
from app.audit import log_event
from app.models import SessionEventType

router = APIRouter(prefix="/branches", tags=["Branches"])


@router.post("", response_model=BranchOut, dependencies=[Depends(require_permissions("assets.manage"))])
def create_branch(payload: BranchCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    existing = db.exec(select(Branch).where(Branch.name == payload.name)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe una sucursal con ese nombre")
    branch = Branch(name=payload.name, code=payload.code, sort_order=payload.sort_order)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    log_event(db, SessionEventType.asset_created, user_id=user.id, metadata={"branch_id": branch.id, "name": branch.name})
    return BranchOut.model_validate(branch, from_attributes=True)


@router.get("", response_model=list[BranchOut], dependencies=[Depends(require_permissions("assets.view"))])
def list_branches(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    branches = db.exec(select(Branch).order_by(Branch.sort_order, Branch.name)).all()
    return [BranchOut.model_validate(b, from_attributes=True) for b in branches]


@router.get("/{branch_id}", response_model=BranchOut, dependencies=[Depends(require_permissions("assets.view"))])
def get_branch(branch_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")
    return BranchOut.model_validate(branch, from_attributes=True)


@router.put("/{branch_id}", response_model=BranchOut, dependencies=[Depends(require_permissions("assets.manage"))])
def update_branch(branch_id: int, payload: BranchCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(branch, key, value)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    log_event(db, SessionEventType.asset_updated, user_id=user.id, metadata={"branch_id": branch.id, "name": branch.name})
    return BranchOut.model_validate(branch, from_attributes=True)


@router.delete("/{branch_id}", dependencies=[Depends(require_permissions("assets.manage"))])
def delete_branch(branch_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")
    db.delete(branch)
    db.commit()
    log_event(db, SessionEventType.asset_deleted, user_id=user.id, metadata={"branch_id": branch_id, "name": branch.name})
    return {"ok": True}

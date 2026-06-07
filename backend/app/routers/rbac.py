from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, delete, select

from app.deps import get_db, require_permissions
from app.models import Permission, Role, RolePermission, User, UserRoleLink

router = APIRouter(prefix="/rbac", tags=["rbac"])

_manage = Depends(require_permissions("rbac.manage"))


class PermissionOut(BaseModel):
    id: int
    code: str
    category: str
    description: str


class RoleOut(BaseModel):
    id: int
    name: str
    description: str
    permissions: list[str]


class RoleCreateIn(BaseModel):
    name: str
    description: str = ""
    permissions: list[str] = []


class RoleUpdateIn(BaseModel):
    description: str = ""
    permissions: list[str] = []


class UserRolesOut(BaseModel):
    user_id: int
    roles: list[str]


class UserRolesIn(BaseModel):
    role_ids: list[int]


@router.get("/permissions", response_model=list[PermissionOut], dependencies=[_manage])
def list_permissions(db: Session = Depends(get_db)):
    perms = db.exec(select(Permission).order_by(Permission.category, Permission.code)).all()
    return [PermissionOut.model_validate(p, from_attributes=True) for p in perms]


@router.get("/roles", response_model=list[RoleOut], dependencies=[_manage])
def list_roles(db: Session = Depends(get_db)):
    roles = db.exec(select(Role).order_by(Role.name)).all()
    out: list[RoleOut] = []
    for r in roles:
        perm_codes = db.exec(
            select(Permission.code)
            .join(RolePermission, Permission.id == RolePermission.permission_id)
            .where(RolePermission.role_id == r.id)
            .order_by(Permission.code)
        ).all()
        out.append(RoleOut(id=r.id, name=r.name, description=r.description, permissions=list(perm_codes)))
    return out


@router.post("/roles", response_model=RoleOut, dependencies=[_manage])
def create_role(payload: RoleCreateIn, db: Session = Depends(get_db)):
    existing = db.exec(select(Role).where(Role.name == payload.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ese rol ya existe")

    r = Role(name=payload.name, description=payload.description)
    db.add(r)
    db.commit()
    db.refresh(r)

    if payload.permissions:
        perm_ids = db.exec(select(Permission.id).where(Permission.code.in_(payload.permissions))).all()
        for pid in perm_ids:
            db.add(RolePermission(role_id=r.id, permission_id=pid))
        db.commit()

    perm_codes = db.exec(
        select(Permission.code)
        .join(RolePermission, Permission.id == RolePermission.permission_id)
        .where(RolePermission.role_id == r.id)
        .order_by(Permission.code)
    ).all()
    return RoleOut(id=r.id, name=r.name, description=r.description, permissions=list(perm_codes))


@router.put("/roles/{role_id}", response_model=RoleOut, dependencies=[_manage])
def update_role(role_id: int, payload: RoleUpdateIn, db: Session = Depends(get_db)):
    r = db.get(Role, role_id)
    if not r:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    r.description = payload.description
    db.add(r)
    db.commit()
    db.refresh(r)

    db.exec(delete(RolePermission).where(RolePermission.role_id == r.id))
    db.commit()

    if payload.permissions:
        perm_ids = db.exec(select(Permission.id).where(Permission.code.in_(payload.permissions))).all()
        for pid in perm_ids:
            db.add(RolePermission(role_id=r.id, permission_id=pid))
        db.commit()

    perm_codes = db.exec(
        select(Permission.code)
        .join(RolePermission, Permission.id == RolePermission.permission_id)
        .where(RolePermission.role_id == r.id)
        .order_by(Permission.code)
    ).all()
    return RoleOut(id=r.id, name=r.name, description=r.description, permissions=list(perm_codes))


@router.delete("/roles/{role_id}", dependencies=[_manage])
def delete_role(role_id: int, db: Session = Depends(get_db)):
    r = db.get(Role, role_id)
    if not r:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    db.exec(delete(UserRoleLink).where(UserRoleLink.role_id == r.id))
    db.exec(delete(RolePermission).where(RolePermission.role_id == r.id))
    db.delete(r)
    db.commit()
    return {"ok": True}


@router.get("/users/{user_id}/roles", response_model=UserRolesOut, dependencies=[_manage])
def get_user_roles(user_id: int, db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    role_names = db.exec(
        select(Role.name)
        .join(UserRoleLink, Role.id == UserRoleLink.role_id)
        .where(UserRoleLink.user_id == user_id)
        .order_by(Role.name)
    ).all()
    return UserRolesOut(user_id=user_id, roles=list(role_names))


@router.put("/users/{user_id}/roles", response_model=UserRolesOut, dependencies=[_manage])
def set_user_roles(user_id: int, payload: UserRolesIn, db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not payload.role_ids:
        raise HTTPException(status_code=400, detail="Debe asignar al menos 1 rol")

    roles = db.exec(select(Role).where(Role.id.in_(payload.role_ids))).all()
    if len(roles) != len(set(payload.role_ids)):
        raise HTTPException(status_code=400, detail="Uno o más roles no existen")

    db.exec(delete(UserRoleLink).where(UserRoleLink.user_id == user_id))
    db.commit()

    for role_id in payload.role_ids:
        db.add(UserRoleLink(user_id=user_id, role_id=role_id))
    db.commit()

    role_names = db.exec(
        select(Role.name)
        .join(UserRoleLink, Role.id == UserRoleLink.role_id)
        .where(UserRoleLink.user_id == user_id)
        .order_by(Role.name)
    ).all()
    return UserRolesOut(user_id=user_id, roles=list(role_names))

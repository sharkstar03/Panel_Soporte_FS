from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from app.db import engine
from app.models import Permission, Role, RolePermission, User, UserRole, UserRoleLink
from app.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
    with Session(engine) as session:
        yield session


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    username = decode_token(token)
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    user = db.exec(select(User).where(User.username == username)).first()
    if not user or not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no válido")
    return user


def require_role(*roles: UserRole):
    def _checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
        return user

    return _checker


def get_user_permission_codes(db: Session, user: User) -> set[str]:
    if user.role == UserRole.admin:
        return {"*"}

    codes = db.exec(
        select(Permission.code)
        .join(RolePermission, Permission.id == RolePermission.permission_id)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRoleLink, UserRoleLink.role_id == Role.id)
        .where(UserRoleLink.user_id == user.id)
        .distinct()
    ).all()
    return set(codes)


def require_permissions(*permissions: str):
    def _checker(
        user: Annotated[User, Depends(get_current_user)],
        db: Annotated[Session, Depends(get_db)],
    ) -> User:
        codes = get_user_permission_codes(db, user)
        if "*" in codes:
            return user
        missing = [p for p in permissions if p not in codes]
        if missing:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
        return user

    return _checker

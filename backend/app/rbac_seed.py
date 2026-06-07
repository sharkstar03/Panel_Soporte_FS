from sqlmodel import Session, delete, select

from app.models import Permission, Role, RolePermission, User, UserRole, UserRoleLink


def seed_rbac(db: Session) -> None:
    defaults: list[tuple[str, str, str]] = [
        ("dashboard.view", "core", "Ver dashboard"),
        ("users.manage", "admin", "Administrar usuarios"),
        ("assets.view", "assets", "Ver activos"),
        ("assets.manage", "assets", "Crear/editar/eliminar activos"),
        ("sessions.view", "sessions", "Ver sesiones"),
        ("sessions.manage", "sessions", "Crear/cerrar sesiones"),
        ("documents.view", "documents", "Ver documentos"),
        ("documents.create", "documents", "Crear documentos"),
        ("documents.delete", "documents", "Eliminar documentos"),
        ("documents.approve", "documents", "Aprobar/rechazar documentos"),
        ("kb.view", "kb", "Ver base de conocimiento"),
        ("kb.manage", "kb", "Crear/editar/eliminar artículos"),
        ("links.view", "links", "Ver links"),
        ("links.manage", "links", "Crear/eliminar links"),
        ("passwords.view", "secrets", "Ver listado de contraseñas"),
        ("passwords.reveal", "secrets", "Revelar contraseñas"),
        ("passwords.manage", "secrets", "Crear/eliminar contraseñas"),
        ("otp.view", "secrets", "Ver listado de OTP"),
        ("otp.reveal", "secrets", "Revelar OTP"),
        ("otp.manage", "secrets", "Crear/eliminar OTP"),
        ("security_keys.view", "secrets", "Ver listado de llaves"),
        ("security_keys.reveal", "secrets", "Revelar llaves"),
        ("security_keys.manage", "secrets", "Crear/eliminar llaves"),
        ("audit.view", "admin", "Ver auditoría"),
        ("settings.manage", "admin", "Ver/editar configuración"),
        ("admin.purge", "admin", "Ejecutar purgas administrativas"),
        ("rbac.manage", "admin", "Administrar roles y permisos"),
    ]

    existing = {p.code: p for p in db.exec(select(Permission)).all()}
    for code, category, description in defaults:
        if code in existing:
            p = existing[code]
            p.category = category
            p.description = description
            db.add(p)
        else:
            db.add(Permission(code=code, category=category, description=description))
    db.commit()

    perm_by_code = {p.code: p for p in db.exec(select(Permission)).all()}

    def ensure_role(name: str, description: str) -> Role:
        r = db.exec(select(Role).where(Role.name == name)).first()
        if r:
            r.description = description
            db.add(r)
            db.commit()
            db.refresh(r)
            return r
        r = Role(name=name, description=description)
        db.add(r)
        db.commit()
        db.refresh(r)
        return r

    admin_role = ensure_role("admin", "Administrador")
    supervisor_role = ensure_role("supervisor", "Supervisor")
    tecnico_role = ensure_role("tecnico", "Técnico")

    role_perms: dict[str, set[str]] = {
        "admin": {c for c in perm_by_code.keys()},
        "supervisor": {
            "dashboard.view",
            "users.manage",
            "assets.view", "assets.manage",
            "sessions.view", "sessions.manage",
            "documents.view", "documents.create", "documents.delete", "documents.approve",
            "kb.view", "kb.manage",
            "links.view", "links.manage",
            "passwords.view", "passwords.reveal", "passwords.manage",
            "otp.view", "otp.reveal", "otp.manage",
            "security_keys.view", "security_keys.reveal", "security_keys.manage",
            "audit.view",
            "settings.manage",
        },
        "tecnico": {
            "dashboard.view",
            "assets.view",
            "sessions.view", "sessions.manage",
            "documents.view", "documents.create",
            "kb.view",
            "links.view",
            "passwords.view",
            "otp.view",
            "security_keys.view",
        },
    }

    roles: dict[str, Role] = {"admin": admin_role, "supervisor": supervisor_role, "tecnico": tecnico_role}
    for role_name, codes in role_perms.items():
        role = roles[role_name]
        db.exec(delete(RolePermission).where(RolePermission.role_id == role.id))
        db.commit()
        for code in sorted(codes):
            p = perm_by_code.get(code)
            if not p:
                continue
            db.add(RolePermission(role_id=role.id, permission_id=p.id))
        db.commit()

    users = db.exec(select(User)).all()
    for u in users:
        links = db.exec(select(UserRoleLink).where(UserRoleLink.user_id == u.id)).all()
        if links:
            continue
        if u.role == UserRole.admin:
            db.add(UserRoleLink(user_id=u.id, role_id=admin_role.id))
        elif u.role == UserRole.supervisor:
            db.add(UserRoleLink(user_id=u.id, role_id=supervisor_role.id))
        else:
            db.add(UserRoleLink(user_id=u.id, role_id=tecnico_role.id))
    db.commit()

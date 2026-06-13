from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class UserRole(str, Enum):
    admin = "admin"
    supervisor = "supervisor"
    tecnico = "tecnico"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    role: UserRole = Field(default=UserRole.tecnico)
    active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    email: Optional[str] = Field(default=None, index=True)
    email_verified: bool = Field(default=False)
    display_name: Optional[str] = None
    avatar_key: Optional[str] = None
    birthday: Optional[date] = None
    theme: str = Field(default="dark")


class EmailVerificationToken(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    token: str = Field(index=True, unique=True)
    expires_at: datetime
    used_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PasswordResetToken(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    token: str = Field(index=True, unique=True)
    expires_at: datetime
    used_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserSmtpConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True, unique=True)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password_enc: str = ""
    smtp_from_email: str = ""
    smtp_tls: bool = True
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AssetType(str, Enum):
    pc = "pc"
    servidor = "servidor"
    otro = "otro"


class Branch(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    code: Optional[str] = Field(default=None, index=True)
    # Posición/orden para listas en UI (menor = más arriba)
    sort_order: int = Field(default=0, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Asset(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    type: AssetType = Field(default=AssetType.pc)
    owner: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    branch_id: Optional[int] = Field(default=None, foreign_key="branch.id", index=True)

    hostname: Optional[str] = Field(default=None, index=True)
    ip: Optional[str] = Field(default=None, index=True)

    anydesk_id: Optional[str] = Field(default=None, index=True)
    anydesk_password: Optional[str] = Field(default=None)
    rustdesk_id: Optional[str] = Field(default=None, index=True)
    rustdesk_password: Optional[str] = Field(default=None)
    teamviewer_id: Optional[str] = Field(default=None, index=True)
    teamviewer_password: Optional[str] = Field(default=None)
    vnc_host: Optional[str] = Field(default=None, index=True)
    vnc_port: int = 5900
    rdp_host: Optional[str] = Field(default=None, index=True)
    rdp_port: int = 3389
    rdp_username: Optional[str] = Field(default=None)

    sensitive: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RemoteTool(str, Enum):
    anydesk = "anydesk"
    rustdesk = "rustdesk"
    teamviewer = "teamviewer"
    ultravnc = "ultravnc"
    rdp = "rdp"


class SessionStatus(str, Enum):
    created = "created"
    in_progress = "in_progress"
    closed = "closed"


class SessionResult(str, Enum):
    resuelto = "resuelto"
    pendiente = "pendiente"
    escalado = "escalado"
    no_se_pudo_acceder = "no_se_pudo_acceder"


class SupportSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True, foreign_key="user.id")
    asset_id: int = Field(index=True, foreign_key="asset.id")

    tool: RemoteTool = Field(index=True)
    reason: str
    ticket: Optional[str] = Field(default=None, index=True)

    status: SessionStatus = Field(default=SessionStatus.created, index=True)
    start_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    end_at: Optional[datetime] = Field(default=None, index=True)

    result: Optional[SessionResult] = Field(default=None, index=True)
    summary: Optional[str] = None


class SessionEventType(str, Enum):
    login_success = "LOGIN_SUCCESS"
    login_failed = "LOGIN_FAILED"
    session_created = "SESSION_CREATED"
    connect_clicked = "CONNECT_CLICKED"
    session_closed = "SESSION_CLOSED"
    attachment_added = "ATTACHMENT_ADDED"
    attachment_downloaded = "ATTACHMENT_DOWNLOADED"
    asset_created = "ASSET_CREATED"
    asset_updated = "ASSET_UPDATED"
    asset_deleted = "ASSET_DELETED"
    user_created = "USER_CREATED"
    user_updated = "USER_UPDATED"
    user_password_changed = "USER_PASSWORD_CHANGED"
    link_created = "LINK_CREATED"
    link_deleted = "LINK_DELETED"
    kb_created = "KB_CREATED"
    kb_updated = "KB_UPDATED"
    kb_deleted = "KB_DELETED"
    setting_updated = "SETTING_UPDATED"
    password_created = "PASSWORD_CREATED"
    password_deleted = "PASSWORD_DELETED"
    password_viewed = "PASSWORD_VIEWED"
    otp_created = "OTP_CREATED"
    otp_deleted = "OTP_DELETED"
    otp_viewed = "OTP_VIEWED"
    seckey_created = "SECKEY_CREATED"
    seckey_deleted = "SECKEY_DELETED"
    seckey_viewed = "SECKEY_VIEWED"
    document_created = "DOCUMENT_CREATED"
    document_approved = "DOCUMENT_APPROVED"
    document_rejected = "DOCUMENT_REJECTED"
    document_downloaded = "DOCUMENT_DOWNLOADED"
    user_profile_updated = "USER_PROFILE_UPDATED"
    user_avatar_updated = "USER_AVATAR_UPDATED"
    email_verification_sent = "EMAIL_VERIFICATION_SENT"
    email_verified = "EMAIL_VERIFIED"
    password_reset_requested = "PASSWORD_RESET_REQUESTED"
    password_reset_completed = "PASSWORD_RESET_COMPLETED"


class SessionEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: Optional[int] = Field(default=None, index=True, foreign_key="supportsession.id")
    user_id: Optional[int] = Field(default=None, index=True, foreign_key="user.id")
    type: str = Field(index=True)   # was SessionEventType enum; converted to VARCHAR to avoid enum sync issues
    at: datetime = Field(default_factory=datetime.utcnow, index=True)
    metadata_json: Optional[str] = None


class Attachment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(index=True, foreign_key="supportsession.id")
    filename: str
    mime: str
    size: int
    storage_key: str = Field(index=True)
    checksum: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class Link(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    url: str
    category: str = "general"
    roles_allowed: str = "admin,supervisor,tecnico"


class KBArticle(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    content_md: str
    tags: Optional[str] = None
    category: str = "general"
    roles_allowed: str = "admin,supervisor,tecnico"
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class SystemSetting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(index=True, unique=True)
    value: str
    description: Optional[str] = None
    category: str = "general"
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by_id: Optional[int] = Field(default=None, foreign_key="user.id")


class PasswordEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    username: Optional[str] = None
    password_encrypted: str
    url: Optional[str] = None
    notes: Optional[str] = None
    category: str = "general"
    roles_allowed: str = "admin,supervisor,tecnico"
    created_by_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class OTPEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    issuer: Optional[str] = None
    account: Optional[str] = None
    secret_encrypted: str
    algorithm: str = "SHA1"
    digits: int = 6
    period: int = 30
    category: str = "general"
    roles_allowed: str = "admin,supervisor,tecnico"
    created_by_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class KeyType(str, Enum):
    ssh_private = "ssh_private"
    ssh_public = "ssh_public"
    api_key = "api_key"
    license_key = "license_key"
    certificate = "certificate"
    other = "other"


class SecurityKeyEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    key_type: KeyType = Field(default=KeyType.api_key, index=True)
    content_encrypted: str
    description: Optional[str] = None
    expires_at: Optional[datetime] = None
    category: str = "general"
    roles_allowed: str = "admin,supervisor,tecnico"
    created_by_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DocumentType(str, Enum):
    entrega_equipo = "entrega_equipo"
    control_equipo = "control_equipo"
    pago_proveedor = "pago_proveedor"
    checklist_diario = "checklist_diario"


class DocumentStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    type: DocumentType = Field(index=True)
    title: str = Field(index=True)
    data_json: str  # JSON blob of form fields
    template_id: Optional[int] = Field(default=None, foreign_key="documenttemplate.id", index=True)
    rendered_html: Optional[str] = None
    status: DocumentStatus = Field(default=DocumentStatus.pending, index=True)
    created_by_id: int = Field(foreign_key="user.id", index=True)
    approver_email: str
    token: str = Field(index=True, unique=True)
    token_expires_at: datetime = Field(...)  # created_at + 7 days, set by router
    download_expires_at: Optional[datetime] = Field(default=None)  # approved_at + 24h
    approved_at: Optional[datetime] = Field(default=None)
    rejection_reason: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DocumentEvidence(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id", index=True)
    checklist_item: str
    storage_key: str
    filename: str
    mime: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


class DocumentTemplate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    doc_type: DocumentType = Field(index=True)
    html: str
    is_default: bool = Field(default=False, index=True)
    created_by_id: int = Field(foreign_key="user.id", index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


# ─────────────────────────────────────────────────────────────────────────────
# Impresoras fiscales (integración PlaceFT / DGI)
# ─────────────────────────────────────────────────────────────────────────────


class FiscalConfig(SQLModel, table=True):
    """Configuración global (una sola fila) de la cuenta DGI/PlaceFT.

    La contraseña se guarda cifrada con la bóveda (MASTER_KEY), igual que el
    resto de secretos del panel.
    """

    id: Optional[int] = Field(default=1, primary_key=True)
    username: str = Field(default="")
    password_enc: str = Field(default="")
    taxpayer_id: str = Field(default="")
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by_id: Optional[int] = Field(default=None, foreign_key="user.id")


class FiscalMapping(SQLModel, table=True):
    """Datos internos editables por el equipo de soporte para cada impresora,
    indexados por número de serie (no provienen de la DGI)."""

    serie: str = Field(primary_key=True)
    sucursal: Optional[str] = Field(default=None, index=True)
    caja: Optional[str] = None
    sistema: Optional[str] = None
    detalle: Optional[str] = None
    z_nota: Optional[str] = None
    estado_interno: Optional[str] = None
    # Activo del panel vinculado a esta impresora: las conexiones remotas se
    # gestionan desde Activos/Sesiones (y quedan registradas como sesión).
    asset_id: Optional[int] = Field(default=None, foreign_key="asset.id", index=True)
    # (Heredados del proyecto original; ya no se usan en la UI, se conservan por
    # compatibilidad con datos migrados.)
    anydesk_id: Optional[str] = None
    anydesk_password: Optional[str] = None
    mantenimiento_ultimo: Optional[str] = None
    mantenimiento_proximo: Optional[str] = None
    alerta_nota: Optional[str] = None
    manual_diagnosis: Optional[str] = None
    imagenes: Optional[str] = None  # JSON array [{name, file}]
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class FiscalMachineIndex(SQLModel, table=True):
    """Caché serie -> machineId/taxpayerId resuelta desde la API de PlaceFT."""

    serie: str = Field(primary_key=True)
    machine_id: Optional[str] = None
    taxpayer_id: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class FiscalZCache(SQLModel, table=True):
    """Último Reporte Z conocido por serie (persistente entre consultas)."""

    serie: str = Field(primary_key=True)
    datez: Optional[str] = None
    numz: Optional[str] = None
    transmission_date: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class FiscalDiagnosticOption(SQLModel, table=True):
    """Opciones de diagnóstico rápido reutilizables para las impresoras."""

    option: str = Field(primary_key=True)


class Permission(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)
    category: str = Field(default="general", index=True)
    description: str = Field(default="")


class Role(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    description: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RolePermission(SQLModel, table=True):
    role_id: int = Field(foreign_key="role.id", primary_key=True)
    permission_id: int = Field(foreign_key="permission.id", primary_key=True)


class UserRoleLink(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    role_id: int = Field(foreign_key="role.id", primary_key=True)

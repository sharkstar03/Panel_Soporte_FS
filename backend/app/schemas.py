from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.models import AssetType, DocumentStatus, DocumentType, KeyType, RemoteTool, SessionEventType, SessionResult, SessionStatus, UserRole


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    role: UserRole
    active: bool
    created_at: datetime
    roles: list[str] = []
    permissions: list[str] = []


class SupervisorOut(BaseModel):
    id: int
    username: str
    role: UserRole


class UserCreateIn(BaseModel):
    username: str
    password: str
    role: UserRole = UserRole.tecnico


class UserSmtpOut(BaseModel):
    user_id: int
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_from_email: str
    smtp_tls: bool
    has_password: bool


class UserSmtpUpdateIn(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_username: str
    smtp_password: Optional[str] = None
    smtp_from_email: str = ""
    smtp_tls: bool = True


class BranchCreateIn(BaseModel):
    name: str
    code: Optional[str] = None
    sort_order: int = 0


class BranchOut(BaseModel):
    id: int
    name: str
    code: Optional[str]
    sort_order: int
    created_at: datetime


class AssetCreateIn(BaseModel):
    name: str
    type: AssetType = AssetType.pc
    owner: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    branch_id: Optional[int] = None
    hostname: Optional[str] = None
    ip: Optional[str] = None
    anydesk_id: Optional[str] = None
    anydesk_password: Optional[str] = None
    rustdesk_id: Optional[str] = None
    rustdesk_password: Optional[str] = None
    teamviewer_id: Optional[str] = None
    teamviewer_password: Optional[str] = None
    vnc_host: Optional[str] = None
    vnc_port: int = 5900
    rdp_host: Optional[str] = None
    rdp_port: int = 3389
    rdp_username: Optional[str] = None
    sensitive: bool = False


class AssetOut(BaseModel):
    id: int
    name: str
    type: AssetType
    owner: Optional[str]
    location: Optional[str]
    notes: Optional[str]
    branch_id: Optional[int]
    hostname: Optional[str]
    ip: Optional[str]
    anydesk_id: Optional[str]
    anydesk_password: Optional[str]
    rustdesk_id: Optional[str]
    rustdesk_password: Optional[str]
    teamviewer_id: Optional[str]
    teamviewer_password: Optional[str]
    vnc_host: Optional[str]
    vnc_port: int
    rdp_host: Optional[str]
    rdp_port: int
    rdp_username: Optional[str]
    sensitive: bool
    created_at: datetime


class SessionCreateIn(BaseModel):
    asset_id: int
    tool: RemoteTool
    reason: str
    ticket: Optional[str] = None


class SessionCloseIn(BaseModel):
    result: SessionResult
    summary: str


class SessionOut(BaseModel):
    id: int
    user_id: int
    asset_id: int
    tool: RemoteTool
    reason: str
    ticket: Optional[str]
    status: SessionStatus
    start_at: datetime
    end_at: Optional[datetime]
    result: Optional[SessionResult]
    summary: Optional[str]


class SessionEventOut(BaseModel):
    id: int
    session_id: Optional[int]
    user_id: Optional[int]
    type: str
    at: datetime
    metadata_json: Optional[str]


class SessionAttachmentOut(BaseModel):
    id: int
    session_id: int
    filename: str
    mime: str
    size: int
    uploaded_at: datetime


class SessionReportOut(BaseModel):
    session: SessionOut
    creator_username: str
    asset_name: str
    branch_name: Optional[str]
    events: list[SessionEventOut]
    attachments: list[SessionAttachmentOut]


class AttachmentOut(BaseModel):
    id: int
    session_id: int
    filename: str
    mime: str
    size: int
    storage_key: str
    uploaded_at: datetime


class LinkIn(BaseModel):
    title: str
    url: str
    category: str = "general"
    roles_allowed: str = "admin,supervisor,tecnico"


class LinkOut(LinkIn):
    id: int


class KBIn(BaseModel):
    title: str
    content_md: str
    tags: Optional[str] = None
    category: str = "general"
    roles_allowed: str = "admin,supervisor,tecnico"


class KBOut(KBIn):
    id: int
    updated_at: datetime


class AuditEventOut(BaseModel):
    id: int
    type: str
    user_id: Optional[int]
    session_id: Optional[int]
    at: datetime
    metadata_json: Optional[str]


class SettingOut(BaseModel):
    id: int
    key: str
    value: str
    description: Optional[str]
    category: str
    updated_at: datetime
    updated_by_id: Optional[int]


class SettingUpdateIn(BaseModel):
    value: Any


class PasswordCreateIn(BaseModel):
    title: str
    username: Optional[str] = None
    password: str
    url: Optional[str] = None
    notes: Optional[str] = None
    category: str = "general"
    roles_allowed: str = "admin,supervisor,tecnico"


class PasswordOut(BaseModel):
    id: int
    title: str
    username: Optional[str]
    password_plain: Optional[str] = None
    url: Optional[str]
    notes: Optional[str]
    category: str
    roles_allowed: str
    created_by_id: int
    created_at: datetime
    updated_at: datetime


class OTPCreateIn(BaseModel):
    title: str
    issuer: Optional[str] = None
    account: Optional[str] = None
    secret: str
    algorithm: str = "SHA1"
    digits: int = 6
    period: int = 30
    category: str = "general"
    roles_allowed: str = "admin,supervisor,tecnico"


class OTPOut(BaseModel):
    id: int
    title: str
    issuer: Optional[str]
    account: Optional[str]
    algorithm: str
    digits: int
    period: int
    category: str
    roles_allowed: str
    created_by_id: int
    created_at: datetime


class OTPRevealOut(OTPOut):
    secret: str


class SecurityKeyCreateIn(BaseModel):
    title: str
    key_type: KeyType = KeyType.api_key
    content: str
    description: Optional[str] = None
    expires_at: Optional[datetime] = None
    category: str = "general"
    roles_allowed: str = "admin,supervisor,tecnico"


class SecurityKeyOut(BaseModel):
    id: int
    title: str
    key_type: KeyType
    description: Optional[str]
    expires_at: Optional[datetime]
    category: str
    roles_allowed: str
    created_by_id: int
    created_at: datetime
    updated_at: datetime


class SecurityKeyRevealOut(SecurityKeyOut):
    content: str


# ── Documents ──────────────────────────────────────────────────────────────

class DocumentCreateIn(BaseModel):
    type: DocumentType
    title: str
    data_json: str          # JSON-encoded form fields
    approver_email: str


class DocumentUpdateIn(BaseModel):
    title: str
    data_json: str          # JSON-encoded form fields


class DocumentEvidenceOut(BaseModel):
    id: int
    document_id: int
    checklist_item: str
    filename: str
    mime: str
    uploaded_at: datetime


class DocumentOut(BaseModel):
    id: int
    type: DocumentType
    title: str
    data_json: str
    status: DocumentStatus
    created_by_id: int
    approver_email: str
    token: str
    token_expires_at: datetime
    download_expires_at: Optional[datetime]
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    created_at: datetime


class PublicDocumentOut(BaseModel):
    """Returned by /approve/:token — no auth required, subset of DocumentOut."""
    id: int
    type: DocumentType
    title: str
    data_json: str
    status: DocumentStatus
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    download_expires_at: Optional[datetime]
    token_expires_at: datetime


class RejectIn(BaseModel):
    reason: str

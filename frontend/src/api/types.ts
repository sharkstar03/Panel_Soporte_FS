export type UserRole = 'admin' | 'supervisor' | 'tecnico'
export type AssetType = 'pc' | 'servidor' | 'otro'
export type RemoteTool = 'anydesk' | 'rustdesk' | 'teamviewer' | 'ultravnc' | 'rdp'
export type SessionStatus = 'created' | 'in_progress' | 'closed'
export type SessionResult = 'resuelto' | 'pendiente' | 'escalado' | 'no_se_pudo_acceder'
export type KeyType = 'ssh_private' | 'ssh_public' | 'api_key' | 'license_key' | 'certificate' | 'other'
export type SessionEventType =
  | 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'SESSION_CREATED' | 'CONNECT_CLICKED'
  | 'SESSION_CLOSED' | 'ATTACHMENT_ADDED' | 'ATTACHMENT_DOWNLOADED'
  | 'ASSET_CREATED' | 'ASSET_UPDATED' | 'ASSET_DELETED' | 'USER_CREATED'
  | 'LINK_CREATED' | 'LINK_DELETED' | 'KB_CREATED' | 'KB_UPDATED' | 'KB_DELETED'
  | 'SETTING_UPDATED' | 'PASSWORD_CREATED' | 'PASSWORD_DELETED' | 'PASSWORD_VIEWED'
  | 'OTP_CREATED' | 'OTP_DELETED' | 'OTP_VIEWED'
  | 'SECKEY_CREATED' | 'SECKEY_DELETED' | 'SECKEY_VIEWED'

export interface User {
  id: number
  username: string
  role: UserRole
  active: boolean
  created_at: string
  roles: string[]
  permissions: string[]
}

export interface Permission {
  id: number
  code: string
  category: string
  description: string
}

export interface Role {
  id: number
  name: string
  description: string
  permissions: string[]
}

export interface SupervisorUser {
  id: number
  username: string
  role: UserRole
}

export interface UserSmtpConfig {
  user_id: number
  smtp_host: string
  smtp_port: number
  smtp_username: string
  smtp_from_email: string
  smtp_tls: boolean
  has_password: boolean
}

export interface UserSmtpUpdateIn {
  smtp_host: string
  smtp_port: number
  smtp_username: string
  smtp_password?: string | null
  smtp_from_email: string
  smtp_tls: boolean
}

export interface Branch {
  id: number
  name: string
  code: string | null
  sort_order: number
  created_at: string
}

export interface BranchCreateIn {
  name: string
  code?: string
  sort_order?: number
}

export interface Asset {
  id: number
  name: string
  type: AssetType
  owner: string | null
  location: string | null
  notes: string | null
  branch_id: number | null
  hostname: string | null
  ip: string | null
  anydesk_id: string | null
  anydesk_password: string | null
  rustdesk_id: string | null
  rustdesk_password: string | null
  teamviewer_id: string | null
  teamviewer_password: string | null
  vnc_host: string | null
  vnc_port: number
  rdp_host: string | null
  rdp_port: number
  rdp_username: string | null
  sensitive: boolean
  created_at: string
}

export interface AssetCreateIn {
  name: string
  type: AssetType
  owner?: string
  location?: string
  notes?: string
  branch_id?: number
  hostname?: string
  ip?: string
  anydesk_id?: string
  anydesk_password?: string
  rustdesk_id?: string
  rustdesk_password?: string
  teamviewer_id?: string
  teamviewer_password?: string
  vnc_host?: string
  vnc_port?: number
  rdp_host?: string
  rdp_port?: number
  rdp_username?: string
  sensitive?: boolean
}

export interface SupportSession {
  id: number
  user_id: number
  asset_id: number
  tool: RemoteTool
  reason: string
  ticket: string | null
  status: SessionStatus
  start_at: string
  end_at: string | null
  result: SessionResult | null
  summary: string | null
}

export interface SessionCreateIn {
  asset_id: number
  tool: RemoteTool
  reason: string
  ticket?: string
}

export interface SessionCloseIn {
  result: SessionResult
  summary: string
}

export interface SessionEventOut {
  id: number
  session_id: number | null
  user_id: number | null
  type: string
  at: string
  metadata_json: string | null
}

export interface SessionAttachmentOut {
  id: number
  session_id: number
  filename: string
  mime: string
  size: number
  uploaded_at: string
}

export interface SessionReportOut {
  session: SupportSession
  creator_username: string
  asset_name: string
  branch_name: string | null
  events: SessionEventOut[]
  attachments: SessionAttachmentOut[]
}

export interface Link {
  id: number; title: string; url: string; category: string; roles_allowed: string
}

export interface LinkIn {
  title: string; url: string; category?: string; roles_allowed?: string
}

export interface KBArticle {
  id: number; title: string; content_md: string
  tags: string | null; category: string; roles_allowed: string; updated_at: string
}

export interface KBIn {
  title: string; content_md: string; tags?: string; category?: string; roles_allowed?: string
}

export interface AuditEvent {
  id: number; type: string; user_id: number | null
  session_id: number | null; at: string; metadata_json: string | null
}

export interface SystemSetting {
  id: number; key: string; value: string; description: string | null
  category: string; updated_at: string; updated_by_id: number | null
}

export interface PasswordEntry {
  id: number; title: string; username: string | null; password_plain?: string
  url: string | null; notes: string | null; category: string
  roles_allowed: string; created_by_id: number; created_at: string; updated_at: string
}

export interface OTPEntry {
  id: number; title: string; issuer: string | null; account: string | null
  algorithm: string; digits: number; period: number; category: string
  roles_allowed: string; created_by_id: number; created_at: string
  secret?: string
}

export interface OTPCreateIn {
  title: string; issuer?: string; account?: string; secret: string
  algorithm?: string; digits?: number; period?: number
  category?: string; roles_allowed?: string
}

export interface SecurityKeyEntry {
  id: number; title: string; key_type: KeyType; description: string | null
  expires_at: string | null; category: string; roles_allowed: string
  created_by_id: number; created_at: string; updated_at: string
  content?: string
}

export interface SecurityKeyCreateIn {
  title: string; key_type: KeyType; content: string; description?: string
  expires_at?: string; category?: string; roles_allowed?: string
}

// ── Documents ────────────────────────────────────────────────────────────

export type DocumentType =
  | 'entrega_equipo'
  | 'control_equipo'
  | 'pago_proveedor'
  | 'checklist_diario'

export type DocumentStatus = 'pending' | 'approved' | 'rejected'

export interface Document {
  id: number
  type: DocumentType
  title: string
  data_json: string
  status: DocumentStatus
  created_by_id: number
  approver_email: string
  token: string
  token_expires_at: string
  download_expires_at: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
}

export interface PublicDocument {
  id: number
  type: DocumentType
  title: string
  data_json: string
  status: DocumentStatus
  approved_at: string | null
  rejection_reason: string | null
  download_expires_at: string | null
  token_expires_at: string
}

export interface DocumentEvidence {
  id: number
  document_id: number
  checklist_item: string
  filename: string
  mime: string
  uploaded_at: string
}

export interface DocumentCreateIn {
  type: DocumentType
  title: string
  data_json: string
  approver_email: string
}

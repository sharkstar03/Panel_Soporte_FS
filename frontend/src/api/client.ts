import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ access_token: string }>('/auth/login', { username, password }),
  me: () => api.get<import('./types').User>('/auth/me'),
  changePassword: (current_password: string, new_password: string) =>
    api.post<{ ok: boolean }>('/auth/change-password', { current_password, new_password }),
}

export const branchesApi = {
  list: () => api.get<import('./types').Branch[]>('/branches'),
  create: (data: import('./types').BranchCreateIn) => api.post<import('./types').Branch>('/branches', data),
  update: (id: number, data: Partial<import('./types').BranchCreateIn>) =>
    api.put<import('./types').Branch>(`/branches/${id}`, data),
  delete: (id: number) => api.delete(`/branches/${id}`),
}

export const assetsApi = {
  list: (params?: { branch_id?: number; q?: string }) =>
    api.get<import('./types').Asset[]>('/assets', { params }),
  remoteSecrets: (id: number) =>
    api.get<{ anydesk_password: string | null; rustdesk_password: string | null; teamviewer_password: string | null }>(`/assets/${id}/remote-secrets`),
  create: (data: import('./types').AssetCreateIn) => api.post<import('./types').Asset>('/assets', data),
  update: (id: number, data: Partial<import('./types').AssetCreateIn>) =>
    api.put<import('./types').Asset>(`/assets/${id}`, data),
  delete: (id: number) => api.delete(`/assets/${id}`),
}

export const sessionsApi = {
  list: (params?: { asset_id?: number; status?: string }) =>
    api.get<import('./types').SupportSession[]>('/sessions', { params }),
  get: (id: number) => api.get<import('./types').SupportSession>(`/sessions/${id}`),
  create: (data: import('./types').SessionCreateIn) =>
    api.post<import('./types').SupportSession>('/sessions', data),
  connect: (id: number) =>
    api.post<import('./types').SupportSession>(`/sessions/${id}/connect`),
  close: (id: number, data: import('./types').SessionCloseIn) =>
    api.post<import('./types').SupportSession>(`/sessions/${id}/close`, data),
  getReport: (id: number) =>
    api.get<import('./types').SessionReportOut>(`/sessions/${id}/report`),
  downloadReportPdf: (id: number) =>
    api.get(`/sessions/${id}/report/pdf`, { responseType: 'blob' }),
}

export const linksApi = {
  list: () => api.get<import('./types').Link[]>('/links'),
  create: (data: import('./types').LinkIn) => api.post<import('./types').Link>('/links', data),
  delete: (id: number) => api.delete(`/links/${id}`),
}

export const kbApi = {
  list: () => api.get<import('./types').KBArticle[]>('/kb'),
  get: (id: number) => api.get<import('./types').KBArticle>(`/kb/${id}`),
  create: (data: import('./types').KBIn) => api.post<import('./types').KBArticle>('/kb', data),
  update: (id: number, data: Partial<import('./types').KBIn>) =>
    api.put<import('./types').KBArticle>(`/kb/${id}`, data),
  delete: (id: number) => api.delete(`/kb/${id}`),
}

export const usersApi = {
  list: () => api.get<import('./types').User[]>('/users'),
  create: (data: { username: string; password: string; role: import('./types').UserRole }) =>
    api.post<import('./types').User>('/users', data),
  update: (userId: number, data: { role?: import('./types').UserRole; active?: boolean }) =>
    api.put<import('./types').User>(`/users/${userId}`, data),
  setPassword: (userId: number, new_password: string) =>
    api.post<{ ok: boolean }>(`/users/${userId}/password`, { new_password }),
  supervisors: () => api.get<import('./types').SupervisorUser[]>('/users/supervisors'),
  getSmtp: (userId: number) => api.get<import('./types').UserSmtpConfig>(`/users/${userId}/smtp`),
  updateSmtp: (userId: number, data: import('./types').UserSmtpUpdateIn) =>
    api.put<import('./types').UserSmtpConfig>(`/users/${userId}/smtp`, data),
}

export const rbacApi = {
  permissions: () => api.get<import('./types').Permission[]>('/rbac/permissions'),
  roles: () => api.get<import('./types').Role[]>('/rbac/roles'),
  createRole: (data: { name: string; description?: string; permissions: string[] }) =>
    api.post<import('./types').Role>('/rbac/roles', data),
  updateRole: (id: number, data: { description?: string; permissions: string[] }) =>
    api.put<import('./types').Role>(`/rbac/roles/${id}`, data),
  deleteRole: (id: number) => api.delete(`/rbac/roles/${id}`),
  userRoles: (userId: number) => api.get<{ user_id: number; roles: string[] }>(`/rbac/users/${userId}/roles`),
  setUserRoles: (userId: number, role_ids: number[]) =>
    api.put<{ user_id: number; roles: string[] }>(`/rbac/users/${userId}/roles`, { role_ids }),
}

export const otpApi = {
  list: () => api.get<import('./types').OTPEntry[]>('/otp'),
  create: (data: import('./types').OTPCreateIn) => api.post<import('./types').OTPEntry>('/otp', data),
  reveal: (id: number) => api.get<import('./types').OTPEntry>(`/otp/${id}/reveal`),
  delete: (id: number) => api.delete(`/otp/${id}`),
}

export const securityKeysApi = {
  list: () => api.get<import('./types').SecurityKeyEntry[]>('/security-keys'),
  create: (data: import('./types').SecurityKeyCreateIn) => api.post<import('./types').SecurityKeyEntry>('/security-keys', data),
  reveal: (id: number) => api.get<import('./types').SecurityKeyEntry>(`/security-keys/${id}/reveal`),
  delete: (id: number) => api.delete(`/security-keys/${id}`),
}

export const auditApi = {
  list: (params?: { limit?: number; offset?: number; event_type?: string }) =>
    api.get<import('./types').AuditEvent[]>('/audit', { params }),
}

export const settingsApi = {
  list: () => api.get<import('./types').SystemSetting[]>('/settings'),
  get: (key: string) => api.get<import('./types').SystemSetting>(`/settings/${key}`),
  update: (key: string, value: any) => api.put<import('./types').SystemSetting>(`/settings/${key}`, { value }),
  getPublic: (key: string) => api.get<{ key: string; value: any }>(`/settings/public/${key}`),
}

export const passwordsApi = {
  list: () => api.get<import('./types').PasswordEntry[]>('/passwords'),
  create: (data: { title: string; username?: string; password: string; url?: string; notes?: string; category?: string; roles_allowed?: string }) =>
    api.post<import('./types').PasswordEntry>('/passwords', data),
  delete: (id: number) => api.delete(`/passwords/${id}`),
  reveal: (id: number) => api.get<{ password: string }>(`/passwords/${id}/reveal`),
}

export const documentsApi = {
  list: (params?: { status?: string; type?: string }) =>
    api.get<import('./types').Document[]>('/documents', { params }),
  get: (id: number) =>
    api.get<import('./types').Document>(`/documents/${id}`),
  create: (data: import('./types').DocumentCreateIn) =>
    api.post<import('./types').Document>('/documents', data),
  update: (id: number, data: { title: string; data_json: string }) =>
    api.put<import('./types').Document>(`/documents/${id}`, data),
  delete: (id: number) =>
    api.delete(`/documents/${id}`),
  downloadPdf: (id: number) =>
    api.get(`/documents/${id}/pdf`, { responseType: 'blob' }),
  checklistItems: () =>
    api.get<{ items: string[] }>('/documents/config/checklist-items'),
  listEvidence: (id: number) =>
    api.get<import('./types').DocumentEvidence[]>(`/documents/${id}/evidence`),
  uploadEvidence: (id: number, checklistItem: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('checklist_item', checklistItem)
    return api.post<import('./types').DocumentEvidence>(
      `/documents/${id}/evidence`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
  downloadEvidence: (id: number, evidenceId: number) =>
    api.get(`/documents/${id}/evidence/${evidenceId}`, { responseType: 'blob' }),
}

export const documentTemplatesApi = {
  list: (params?: { doc_type?: string }) =>
    api.get<import('./types').DocumentTemplate[]>('/document-templates', { params }),
  create: (data: { name: string; doc_type: string; html: string; is_default: boolean }) =>
    api.post<import('./types').DocumentTemplate>('/document-templates', data),
  update: (id: number, data: { name: string; doc_type: string; html: string; is_default: boolean }) =>
    api.put<import('./types').DocumentTemplate>(`/document-templates/${id}`, data),
  delete: (id: number) => api.delete(`/document-templates/${id}`),
  render: (data: { html: string; data_json: string; title?: string }) =>
    api.post<{ html: string }>('/document-templates/render', data),
}

export const adminApi = {
  purgePreview: (days: number) =>
    api.get<{ documents: number; sessions: number; audit_events: number }>('/admin/purge/preview', { params: { days } }),
  purgeDocuments: (older_than_days: number, status: string) =>
    api.delete<{ deleted: number; message: string }>('/admin/purge/documents', { data: { older_than_days, status } }),
  purgeSessions: (older_than_days: number, only_closed: boolean) =>
    api.delete<{ deleted: number; message: string }>('/admin/purge/sessions', { data: { older_than_days, only_closed } }),
  purgeAudit: (older_than_days: number) =>
    api.delete<{ deleted: number; message: string }>('/admin/purge/audit', { data: { older_than_days } }),
}

export const approveApi = {
  get: (token: string) =>
    api.get<import('./types').PublicDocument>(`/approve/${token}`),
  approve: (token: string) =>
    api.post(`/approve/${token}/approve`),
  reject: (token: string, reason: string) =>
    api.post(`/approve/${token}/reject`, { reason }),
  downloadPdf: (token: string) =>
    api.get(`/approve/${token}/download`, { responseType: 'blob' }),
  listEvidence: (token: string) =>
    api.get<import('./types').DocumentEvidence[]>(`/approve/${token}/evidence`),
  downloadEvidence: (token: string, evidenceId: number) =>
    api.get(`/approve/${token}/evidence/${evidenceId}`, { responseType: 'blob' }),
}

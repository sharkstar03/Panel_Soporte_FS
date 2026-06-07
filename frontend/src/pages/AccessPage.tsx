import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Plus, ShieldCheck, Shield, User as UserIcon, Mail, Pencil, KeyRound, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { usersApi, rbacApi, authApi } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select, FormField } from '../components/ui/Input'
import { PageLoader } from '../components/ui/Spinner'
import { useAuth } from '../context/AuthContext'
import { RBACPage } from './RBACPage'
import type { UserRole, User as UserType, UserSmtpConfig, UserSmtpUpdateIn, Role } from '../api/types'

const roleIcon = { admin: ShieldCheck, supervisor: Shield, tecnico: UserIcon }
const roleBadge = (role: UserRole) => {
  if (role === 'admin') return <Badge variant="cyan">admin</Badge>
  if (role === 'supervisor') return <Badge variant="amber">supervisor</Badge>
  return <Badge variant="muted">técnico</Badge>
}

// ─────────────────────────────────────────────────────────────────────────
// Pestaña: Usuarios
// ─────────────────────────────────────────────────────────────────────────
function UsersTab() {
  const qc = useQueryClient()
  const { user: me, can } = useAuth()
  const canManageRoles = can('rbac.manage')

  const [showCreate, setShowCreate] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('tecnico')

  const [editUser, setEditUser] = useState<UserType | null>(null)
  const [pwdUser, setPwdUser] = useState<UserType | null>(null)
  const [smtpUser, setSmtpUser] = useState<UserType | null>(null)
  const [showSelfPwd, setShowSelfPwd] = useState(false)

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list().then(r => r.data) })

  const create = useMutation({
    mutationFn: (d: { username: string; password: string; role: UserRole }) => usersApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowCreate(false); setUsername(''); setPassword(''); setRole('tecnico'); toast.success('Usuario creado') },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Error al crear usuario'),
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-muted">{users.length} usuarios registrados</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowSelfPwd(true)}><Lock size={14} />Mi contraseña</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} />Nuevo usuario</Button>
        </div>
      </div>

      <div className="bg-panel border border-border rounded-lg overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-border">
              {['Usuario', 'Rol', 'Estado', 'Creado', 'Acciones'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-sans font-medium text-text-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => {
              const Icon = roleIcon[u.role]
              return (
                <motion.tr
                  key={u.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-border/50 hover:bg-elevated/50 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center">
                        <Icon size={13} className={u.role === 'admin' ? 'text-cyan' : u.role === 'supervisor' ? 'text-amber-op' : 'text-text-muted'} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-sans text-sm text-text-primary">{u.username}</span>
                        {me?.id === u.id && <span className="ml-2 text-[10px] font-mono text-cyan">(tú)</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">{roleBadge(u.role)}</td>
                  <td className="px-5 py-3"><Badge variant={u.active ? 'green' : 'red'} dot>{u.active ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td className="px-5 py-3 font-mono text-xs text-text-secondary">{new Date(u.created_at).toLocaleDateString('es-MX')}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" title="Editar rol y estado" onClick={() => setEditUser(u as UserType)}><Pencil size={14} /></Button>
                      <Button size="sm" variant="ghost" title="Resetear contraseña" onClick={() => setPwdUser(u as UserType)}><KeyRound size={14} /></Button>
                      <Button size="sm" variant="ghost" title="Configurar SMTP" onClick={() => setSmtpUser(u as UserType)}><Mail size={14} /></Button>
                    </div>
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Crear usuario */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo usuario">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate({ username, password, role }) }} className="space-y-4">
          <FormField label="Usuario *">
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="tecnico01" required />
          </FormField>
          <FormField label="Contraseña *">
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="mínimo 10 caracteres" required minLength={10} />
          </FormField>
          <p className="text-[11px] text-text-muted -mt-2">Mínimo 10 caracteres, con al menos una letra y un número.</p>
          <FormField label="Rol principal">
            <Select value={role} onChange={e => setRole(e.target.value as UserRole)}>
              <option value="tecnico">Técnico</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </Select>
          </FormField>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={create.isPending} className="flex-1">Crear usuario</Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {editUser && (
        <EditUserModal user={editUser} canManageRoles={canManageRoles} isSelf={me?.id === editUser.id} onClose={() => setEditUser(null)} />
      )}
      {pwdUser && <ResetPasswordModal user={pwdUser} onClose={() => setPwdUser(null)} />}
      {smtpUser && <SmtpModal user={smtpUser} onClose={() => setSmtpUser(null)} />}
      {showSelfPwd && <SelfPasswordModal onClose={() => setShowSelfPwd(false)} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Modal: editar rol principal + estado + roles RBAC
// ─────────────────────────────────────────────────────────────────────────
function EditUserModal({ user, canManageRoles, isSelf, onClose }: { user: UserType; canManageRoles: boolean; isSelf: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [role, setRole] = useState<UserRole>(user.role)
  const [active, setActive] = useState<boolean>(user.active)
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<number>>(new Set())

  const rolesQ = useQuery({ queryKey: ['rbac-roles'], queryFn: () => rbacApi.roles().then(r => r.data), enabled: canManageRoles })
  const userRolesQ = useQuery({
    queryKey: ['user-roles', user.id],
    queryFn: () => rbacApi.userRoles(user.id).then(r => r.data),
    enabled: canManageRoles,
  })

  useEffect(() => {
    const allRoles = (rolesQ.data as Role[] | undefined) ?? []
    const names = userRolesQ.data?.roles ?? []
    setSelectedRoleIds(new Set(allRoles.filter(r => names.includes(r.name)).map(r => r.id)))
  }, [rolesQ.data, userRolesQ.data])

  const save = useMutation({
    mutationFn: async () => {
      await usersApi.update(user.id, { role, active })
      if (canManageRoles && selectedRoleIds.size > 0) {
        await rbacApi.setUserRoles(user.id, Array.from(selectedRoleIds))
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['user-roles', user.id] })
      toast.success('Usuario actualizado')
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Error al actualizar'),
  })

  const allRoles = (rolesQ.data as Role[] | undefined) ?? []
  const toggleRole = (id: number) => setSelectedRoleIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  return (
    <Modal open onClose={onClose} title={`Editar — ${user.username}`} width="max-w-lg">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-4">
        <FormField label="Rol principal">
          <Select value={role} onChange={e => setRole(e.target.value as UserRole)} disabled={isSelf}>
            <option value="tecnico">Técnico</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </Select>
        </FormField>

        <FormField label="Estado">
          <Select value={active ? 'true' : 'false'} onChange={e => setActive(e.target.value === 'true')} disabled={isSelf}>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </Select>
        </FormField>
        {isSelf && <p className="text-[11px] text-amber-op -mt-2">No puedes cambiar tu propio rol ni desactivarte.</p>}

        {canManageRoles && (
          <FormField label="Roles personalizados (permisos finos)">
            <div className="space-y-1.5 max-h-52 overflow-y-auto rounded border border-border bg-base p-2">
              {allRoles.length === 0 && <p className="text-[11px] text-text-muted px-1 py-2">No hay roles definidos.</p>}
              {allRoles.map(r => {
                const checked = selectedRoleIds.has(r.id)
                return (
                  <button key={r.id} type="button" onClick={() => toggleRole(r.id)}
                    className={`w-full text-left px-3 py-2 rounded border transition-colors ${checked ? 'bg-cyan/10 border-cyan/30 text-text-primary' : 'bg-panel border-border text-text-secondary hover:border-border-bright'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-sans text-sm">{r.name}</span>
                      <span className={`text-[10px] font-mono ${checked ? 'text-cyan' : 'text-text-muted'}`}>{checked ? 'ON' : 'OFF'}</span>
                    </div>
                    {!!r.description && <p className="text-[11px] mt-0.5 text-text-muted">{r.description}</p>}
                  </button>
                )
              })}
            </div>
          </FormField>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={save.isPending} className="flex-1">Guardar cambios</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Modal: resetear contraseña (admin)
// ─────────────────────────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose }: { user: UserType; onClose: () => void }) {
  const [pwd, setPwd] = useState('')
  const reset = useMutation({
    mutationFn: () => usersApi.setPassword(user.id, pwd),
    onSuccess: () => { toast.success('Contraseña restablecida'); onClose() },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Error al restablecer'),
  })
  return (
    <Modal open onClose={onClose} title={`Resetear contraseña — ${user.username}`}>
      <form onSubmit={(e) => { e.preventDefault(); reset.mutate() }} className="space-y-4">
        <FormField label="Nueva contraseña *">
          <Input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="mínimo 10 caracteres" required minLength={10} />
        </FormField>
        <p className="text-[11px] text-text-muted -mt-2">Mínimo 10 caracteres, con al menos una letra y un número.</p>
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={reset.isPending} className="flex-1">Restablecer</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Modal: cambiar mi propia contraseña
// ─────────────────────────────────────────────────────────────────────────
function SelfPasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const change = useMutation({
    mutationFn: () => authApi.changePassword(current, next),
    onSuccess: () => { toast.success('Contraseña actualizada'); onClose() },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Error al cambiar la contraseña'),
  })
  return (
    <Modal open onClose={onClose} title="Cambiar mi contraseña">
      <form onSubmit={(e) => { e.preventDefault(); change.mutate() }} className="space-y-4">
        <FormField label="Contraseña actual *">
          <Input type="password" value={current} onChange={e => setCurrent(e.target.value)} required />
        </FormField>
        <FormField label="Nueva contraseña *">
          <Input type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="mínimo 10 caracteres" required minLength={10} />
        </FormField>
        <p className="text-[11px] text-text-muted -mt-2">Mínimo 10 caracteres, con al menos una letra y un número.</p>
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={change.isPending} className="flex-1">Actualizar</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Modal: SMTP por usuario (igual que antes)
// ─────────────────────────────────────────────────────────────────────────
function SmtpModal({ user, onClose }: { user: UserType; onClose: () => void }) {
  const qc = useQueryClient()
  const smtpQuery = useQuery({ queryKey: ['user-smtp', user.id], queryFn: () => usersApi.getSmtp(user.id).then(r => r.data) })
  const cfg = smtpQuery.data as UserSmtpConfig | undefined
  const [edits, setEdits] = useState<UserSmtpUpdateIn>({ smtp_host: '', smtp_port: 587, smtp_username: '', smtp_password: null, smtp_from_email: '', smtp_tls: true })

  const save = useMutation({
    mutationFn: (data: UserSmtpUpdateIn) => usersApi.updateSmtp(user.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['user-smtp', user.id] }); toast.success('SMTP guardado'); onClose() },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Error al guardar SMTP'),
  })

  return (
    <Modal open onClose={onClose} title={`SMTP — ${user.username}`} width="max-w-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({
            smtp_host: edits.smtp_host || cfg?.smtp_host || '',
            smtp_port: edits.smtp_port || cfg?.smtp_port || 587,
            smtp_username: edits.smtp_username || cfg?.smtp_username || '',
            smtp_password: edits.smtp_password,
            smtp_from_email: edits.smtp_from_email || cfg?.smtp_from_email || '',
            smtp_tls: edits.smtp_tls,
          })
        }}
        className="space-y-4"
      >
        <FormField label="SMTP Host">
          <Input value={edits.smtp_host || cfg?.smtp_host || ''} onChange={(e) => setEdits(p => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" required />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Puerto">
            <Input type="number" value={String(edits.smtp_port || cfg?.smtp_port || 587)} onChange={(e) => setEdits(p => ({ ...p, smtp_port: Number(e.target.value) }))} min={1} required />
          </FormField>
          <FormField label="TLS">
            <Select value={String(edits.smtp_tls)} onChange={(e) => setEdits(p => ({ ...p, smtp_tls: e.target.value === 'true' }))}>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Usuario SMTP">
          <Input value={edits.smtp_username || cfg?.smtp_username || ''} onChange={(e) => setEdits(p => ({ ...p, smtp_username: e.target.value }))} placeholder="usuario@empresa.com" required />
        </FormField>
        <FormField label={`Contraseña SMTP${cfg?.has_password ? ' (ya configurada)' : ''}`}>
          <Input type="password" value={edits.smtp_password ?? ''} onChange={(e) => setEdits(p => ({ ...p, smtp_password: e.target.value }))} placeholder={cfg?.has_password ? '••••••••' : ''} />
        </FormField>
        <FormField label="From (opcional)">
          <Input value={edits.smtp_from_email || cfg?.smtp_from_email || ''} onChange={(e) => setEdits(p => ({ ...p, smtp_from_email: e.target.value }))} placeholder="soporte@empresa.com" />
        </FormField>
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={save.isPending} className="flex-1">Guardar</Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Página: Usuarios y Accesos (tabs)
// ─────────────────────────────────────────────────────────────────────────
export function AccessPage() {
  const { can } = useAuth()
  const [sp, setSp] = useSearchParams()
  const canRoles = can('rbac.manage')

  const tabs = useMemo(
    () => [
      { id: 'usuarios', label: 'Usuarios', show: true },
      { id: 'roles', label: 'Roles y permisos', show: canRoles },
    ].filter(t => t.show),
    [canRoles],
  )

  const tabParam = sp.get('tab') || 'usuarios'
  const active = tabs.some(t => t.id === tabParam) ? tabParam : 'usuarios'

  const setTab = (id: string) => { const n = new URLSearchParams(sp); n.set('tab', id); setSp(n, { replace: true }) }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Usuarios y Accesos" subtitle="Gestiona quién entra al panel y qué puede hacer" icon={<Users size={16} />} />

      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-sans transition-colors border-b-2 -mb-px ${
              active === t.id ? 'border-cyan text-cyan' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'roles' && canRoles ? <RBACPage embedded /> : <UsersTab />}
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, Plus, ShieldCheck, Shield, User, Mail } from 'lucide-react'
import { usersApi } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select, FormField } from '../components/ui/Input'
import { PageLoader } from '../components/ui/Spinner'
import type { UserRole } from '../api/types'
import type { User as UserType, UserSmtpConfig, UserSmtpUpdateIn } from '../api/types'

const roleIcon = { admin: ShieldCheck, supervisor: Shield, tecnico: User }
const roleBadge = (role: UserRole) => {
  if (role === 'admin') return <Badge variant="cyan">admin</Badge>
  if (role === 'supervisor') return <Badge variant="amber">supervisor</Badge>
  return <Badge variant="muted">técnico</Badge>
}

export function UsersPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('tecnico')
  const [smtpUser, setSmtpUser] = useState<UserType | null>(null)
  const [smtpEdits, setSmtpEdits] = useState<UserSmtpUpdateIn>({
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: null,
    smtp_from_email: '',
    smtp_tls: true,
  })

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list().then(r => r.data) })
  const smtpQuery = useQuery({
    queryKey: ['user-smtp', smtpUser?.id],
    queryFn: () => usersApi.getSmtp(Number(smtpUser?.id)).then(r => r.data),
    enabled: !!smtpUser?.id,
  })

  const create = useMutation({
    mutationFn: (d: { username: string; password: string; role: UserRole }) => usersApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowCreate(false); setUsername(''); setPassword('') },
  })

  const saveSmtp = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: UserSmtpUpdateIn }) => usersApi.updateSmtp(userId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-smtp', smtpUser?.id] })
      setSmtpUser(null)
    },
  })

  if (isLoading) return <PageLoader />

  const openSmtp = (u: UserType) => {
    setSmtpUser(u)
    setSmtpEdits({
      smtp_host: '',
      smtp_port: 587,
      smtp_username: '',
      smtp_password: null,
      smtp_from_email: '',
      smtp_tls: true,
    })
  }

  const cfg = smtpQuery.data as UserSmtpConfig | undefined

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Usuarios"
        subtitle={`${users.length} usuarios registrados`}
        icon={<Users size={16} />}
        action={<Button onClick={() => setShowCreate(true)} size="sm"><Plus size={14} />Nuevo usuario</Button>}
      />

      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['ID', 'Usuario', 'Rol', 'Estado', 'Creado', ''].map(h => (
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
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 hover:bg-elevated/50 transition-colors"
                >
                  <td className="px-5 py-3 font-mono text-xs text-text-muted">#{u.id}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center">
                        <Icon size={13} className={u.role === 'admin' ? 'text-cyan' : u.role === 'supervisor' ? 'text-amber-op' : 'text-text-muted'} />
                      </div>
                      <span className="font-sans text-sm text-text-primary">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">{roleBadge(u.role)}</td>
                  <td className="px-5 py-3">
                    <Badge variant={u.active ? 'green' : 'red'} dot>{u.active ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-text-secondary">
                    {new Date(u.created_at).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-5 py-3">
                    <Button size="sm" variant="ghost" onClick={() => openSmtp(u as UserType)}>
                      <Mail size={14} />
                    </Button>
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Usuario">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate({ username, password, role }) }} className="space-y-4">
          <FormField label="Usuario *">
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="tecnico01" required />
          </FormField>
          <FormField label="Contraseña *">
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
          </FormField>
          <FormField label="Rol">
            <Select value={role} onChange={e => setRole(e.target.value as UserRole)}>
              <option value="tecnico">Técnico</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </Select>
          </FormField>
          {create.error && (
            <p className="text-xs text-red-op bg-red-op/10 border border-red-op/20 rounded px-3 py-2">
              {(create.error as any)?.response?.data?.detail ?? 'Error al crear usuario'}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={create.isPending} className="flex-1">Crear usuario</Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!smtpUser} onClose={() => setSmtpUser(null)} title={`SMTP — ${smtpUser?.username ?? ''}`} width="max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!smtpUser) return
            const data: UserSmtpUpdateIn = {
              smtp_host: smtpEdits.smtp_host || cfg?.smtp_host || '',
              smtp_port: smtpEdits.smtp_port || cfg?.smtp_port || 587,
              smtp_username: smtpEdits.smtp_username || cfg?.smtp_username || '',
              smtp_password: smtpEdits.smtp_password,
              smtp_from_email: smtpEdits.smtp_from_email || cfg?.smtp_from_email || '',
              smtp_tls: smtpEdits.smtp_tls,
            }
            saveSmtp.mutate({ userId: smtpUser.id, data })
          }}
          className="space-y-4"
        >
          <FormField label="SMTP Host">
            <Input
              value={smtpEdits.smtp_host || cfg?.smtp_host || ''}
              onChange={(e) => setSmtpEdits((p) => ({ ...p, smtp_host: e.target.value }))}
              placeholder="smtp.gmail.com"
              required
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Puerto">
              <Input
                type="number"
                value={String(smtpEdits.smtp_port || cfg?.smtp_port || 587)}
                onChange={(e) => setSmtpEdits((p) => ({ ...p, smtp_port: Number(e.target.value) }))}
                min={1}
                required
              />
            </FormField>
            <FormField label="TLS">
              <Select
                value={String(smtpEdits.smtp_tls)}
                onChange={(e) => setSmtpEdits((p) => ({ ...p, smtp_tls: e.target.value === 'true' }))}
              >
                <option value="true">Sí</option>
                <option value="false">No</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Usuario SMTP">
            <Input
              value={smtpEdits.smtp_username || cfg?.smtp_username || ''}
              onChange={(e) => setSmtpEdits((p) => ({ ...p, smtp_username: e.target.value }))}
              placeholder="usuario@empresa.com"
              required
            />
          </FormField>
          <FormField label={`Contraseña SMTP${cfg?.has_password ? ' (ya configurada)' : ''}`}>
            <Input
              type="password"
              value={smtpEdits.smtp_password ?? ''}
              onChange={(e) => setSmtpEdits((p) => ({ ...p, smtp_password: e.target.value }))}
              placeholder={cfg?.has_password ? '••••••••' : ''}
            />
          </FormField>
          <FormField label="From (opcional)">
            <Input
              value={smtpEdits.smtp_from_email || cfg?.smtp_from_email || ''}
              onChange={(e) => setSmtpEdits((p) => ({ ...p, smtp_from_email: e.target.value }))}
              placeholder="soporte@empresa.com"
            />
          </FormField>
          {saveSmtp.error && (
            <p className="text-xs text-red-op bg-red-op/10 border border-red-op/20 rounded px-3 py-2">
              {(saveSmtp.error as any)?.response?.data?.detail ?? 'Error al guardar SMTP'}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saveSmtp.isPending} className="flex-1">Guardar</Button>
            <Button type="button" variant="ghost" onClick={() => setSmtpUser(null)} disabled={saveSmtp.isPending}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

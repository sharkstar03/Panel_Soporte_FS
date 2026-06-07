import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  KeyRound, Plus, Eye, EyeOff, Copy, Trash2, Shield, Clock, RefreshCw,
  Lock, Key, FolderOpen, Search, ExternalLink, CheckCircle2,
} from 'lucide-react'
import * as OTPAuth from 'otpauth'
import toast from 'react-hot-toast'
import { passwordsApi, otpApi, securityKeysApi, settingsApi } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Textarea, Select, FormField } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import type { KeyType, OTPEntry, PasswordEntry, SecurityKeyEntry } from '../api/types'
import { useAuth } from '../context/AuthContext'

type Tab = 'passwords' | 'otp' | 'keys'

const KEY_TYPE_LABEL: Record<KeyType, string> = {
  ssh_private: 'SSH Privada', ssh_public: 'SSH Pública',
  api_key: 'API Key', license_key: 'Licencia',
  certificate: 'Certificado', other: 'Otro',
}

// ── TOTP live code hook ──────────────────────────────────────────────────────
function useTOTP(secret: string | undefined, algorithm: string, digits: number, period: number) {
  const [code, setCode] = useState('')
  const [remaining, setRemaining] = useState(period)

  useEffect(() => {
    if (!secret) return
    const generate = () => {
      try {
        const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), algorithm: algorithm as any, digits, period })
        setCode(totp.generate())
        setRemaining(period - (Math.floor(Date.now() / 1000) % period))
      } catch { setCode('??????') }
    }
    generate()
    const id = setInterval(generate, 1000)
    return () => clearInterval(id)
  }, [secret, algorithm, digits, period])

  return { code, remaining }
}

// ── OTP Card ─────────────────────────────────────────────────────────────────
function OTPCard({ entry, onDelete, canManage }: { entry: OTPEntry; onDelete: () => void; canManage: boolean }) {
  const [revealed, setRevealed] = useState(false)
  const [secret, setSecret] = useState<string>()
  const { refetch, isFetching } = useQuery({
    queryKey: ['otp-reveal', entry.id],
    queryFn: () => otpApi.reveal(entry.id).then(r => r.data),
    enabled: false,
  })

  const { code, remaining } = useTOTP(secret, entry.algorithm, entry.digits, entry.period)
  const pct = (remaining / entry.period) * 100
  const isLow = remaining <= 5

  const handleReveal = async () => {
    if (!revealed) {
      const r = await refetch()
      if (r.data?.secret) setSecret(r.data.secret)
      setRevealed(true)
    } else setRevealed(false)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-panel border border-border rounded-lg p-4 hover:border-border-bright transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-cyan" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm text-text-primary truncate">{entry.title}</p>
            <p className="font-mono text-[10px] text-text-muted">
              {entry.issuer && `${entry.issuer} · `}{entry.account ?? '—'} · {entry.digits}d/{entry.period}s
            </p>
          </div>
        </div>
        {canManage && <button onClick={onDelete} className="text-text-muted hover:text-red-op transition-colors p-1 flex-shrink-0"><Trash2 size={13} /></button>}
      </div>

      {revealed && secret && (
        <div className="mt-4 bg-base rounded-lg p-4 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={11} className={isLow ? 'text-red-op' : 'text-text-muted'} />
            <span className={`font-mono text-[10px] ${isLow ? 'text-red-op' : 'text-text-muted'}`}>{remaining}s</span>
            <div className="flex-1 h-1 bg-elevated rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${isLow ? 'bg-red-op' : 'bg-cyan'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className={`font-mono text-3xl font-bold tracking-[0.3em] ${isLow ? 'text-red-op animate-pulse' : 'text-cyan'}`}>
              {code.slice(0, 3)} {code.slice(3)}
            </span>
            <button onClick={() => { navigator.clipboard.writeText(code); toast.success('Código copiado') }}
              className="flex items-center gap-1 text-xs font-mono text-text-secondary hover:text-cyan border border-border hover:border-cyan/40 rounded px-2 py-1 transition-colors">
              <Copy size={11} />Copiar
            </button>
          </div>
          <p className="font-mono text-[9px] text-text-muted mt-2 break-all">Secret: {secret}</p>
        </div>
      )}

      <div className="mt-3">
        <Button variant="outline" size="sm" onClick={handleReveal} loading={isFetching} className="w-full !text-xs">
          {revealed ? <><EyeOff size={11} />Ocultar</> : <><Eye size={11} />Ver código OTP</>}
        </Button>
      </div>
    </motion.div>
  )
}

// ── Password Card ─────────────────────────────────────────────────────────────
function PasswordCard({ entry, onDelete, canManage }: { entry: PasswordEntry; onDelete: () => void; canManage: boolean }) {
  const [visible, setVisible] = useState(false)
  const [pwd, setPwd] = useState<string>()
  const { refetch, isFetching } = useQuery({
    queryKey: ['pwd-reveal', entry.id],
    queryFn: () => passwordsApi.reveal(entry.id).then(r => r.data.password),
    enabled: false,
  })

  const handleReveal = async () => {
    if (!visible) { const r = await refetch(); if (r.data) setPwd(r.data); setVisible(true) }
    else setVisible(false)
  }

  const ensureHttps = (url?: string | null) => {
    if (!url) return '#'
    if (/^https?:\/\//i.test(url)) return url
    return `https://${url}`
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-panel border border-border rounded-xl p-4 hover:border-border-bright transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-green-op/10 border border-green-op/20 flex items-center justify-center flex-shrink-0">
            <KeyRound size={16} className="text-green-op" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm text-text-primary truncate">{entry.title}</p>
            {entry.username && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="font-mono text-[10px] text-text-muted">{entry.username}</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(entry.username!); toast.success('Usuario copiado') }}
                  className="text-text-muted hover:text-cyan transition-colors"
                  title="Copiar usuario"
                >
                  <Copy size={10} />
                </button>
              </div>
            )}
            {entry.url && (
              <a href={ensureHttps(entry.url)} target="_blank" rel="noopener noreferrer"
                className="font-mono text-[10px] text-cyan/70 hover:text-cyan flex items-center gap-1 mt-0.5">
                <ExternalLink size={9} />{entry.url.replace(/^https?:\/\//, '').slice(0, 40)}
              </a>
            )}
          </div>
        </div>
        {canManage && <button onClick={onDelete} className="text-text-muted hover:text-red-op transition-colors p-1 flex-shrink-0"><Trash2 size={13} /></button>}
      </div>

      {/* Password reveal area - estilo OTP */}
      <div className="mt-4">
        {visible && pwd ? (
          <div className="bg-base rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between gap-3">
              <code className="font-mono text-lg text-green-op tracking-wider break-all">{pwd}</code>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => { navigator.clipboard.writeText(pwd); toast.success('Contraseña copiada') }}
                  className="flex items-center gap-1 text-xs font-mono text-text-secondary hover:text-cyan border border-border hover:border-cyan/40 rounded px-2 py-1 transition-colors">
                  <Copy size={11} />Copiar
                </button>
                <button onClick={() => setVisible(false)}
                  className="text-text-muted hover:text-text-primary border border-border hover:border-border-bright rounded px-2 py-1 transition-colors">
                  <EyeOff size={11} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-base rounded-lg px-4 py-3 border border-border flex items-center justify-between gap-3">
            <code className="font-mono text-sm text-text-muted tracking-[0.2em]">••••••••••••••••</code>
            <Button variant="ghost" size="sm" onClick={handleReveal} loading={isFetching} className="!text-xs flex-shrink-0">
              <Eye size={11} />Ver
            </Button>
          </div>
        )}
      </div>

      {entry.notes && <p className="mt-3 text-xs font-sans text-text-muted">{entry.notes}</p>}
    </motion.div>
  )
}

// ── Security Key Card ─────────────────────────────────────────────────────────
function SecKeyCard({ entry, onDelete, canManage }: { entry: SecurityKeyEntry; onDelete: () => void; canManage: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [content, setContent] = useState<string>()
  const { refetch, isFetching } = useQuery({
    queryKey: ['seckey-reveal', entry.id],
    queryFn: () => securityKeysApi.reveal(entry.id).then(r => r.data),
    enabled: false,
  })

  const handleReveal = async () => {
    if (!expanded) { const r = await refetch(); if (r.data?.content) setContent(r.data.content); setExpanded(true) }
    else setExpanded(false)
  }

  const isExpired = entry.expires_at && new Date(entry.expires_at) < new Date()

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-panel border rounded-lg p-4 transition-colors ${isExpired ? 'border-red-op/40' : 'border-border hover:border-border-bright'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isExpired ? 'bg-red-op/10 border border-red-op/20' : 'bg-amber-op/10 border border-amber-op/20'}`}>
            <Key size={16} className={isExpired ? 'text-red-op' : 'text-amber-op'} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-display font-semibold text-sm text-text-primary">{entry.title}</p>
              {isExpired && <Badge variant="red">Expirada</Badge>}
            </div>
            <p className="font-mono text-[10px] text-text-muted">{KEY_TYPE_LABEL[entry.key_type]}</p>
            {entry.expires_at && (
              <p className={`font-mono text-[10px] flex items-center gap-1 mt-0.5 ${isExpired ? 'text-red-op' : 'text-amber-op'}`}>
                <Clock size={9} />Vence: {new Date(entry.expires_at).toLocaleDateString('es-MX')}
              </p>
            )}
          </div>
        </div>
        {canManage && <button onClick={onDelete} className="text-text-muted hover:text-red-op transition-colors p-1 flex-shrink-0"><Trash2 size={13} /></button>}
      </div>

      {entry.description && <p className="mt-2 text-xs font-sans text-text-secondary">{entry.description}</p>}

      {expanded && content && (
        <div className="mt-3 relative">
          <pre className="bg-base border border-border rounded p-3 font-mono text-xs text-green-op/80 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all">{content}</pre>
          <button onClick={() => { navigator.clipboard.writeText(content); toast.success('Clave copiada') }}
            className="absolute top-2 right-2 bg-elevated border border-border rounded p-1 text-text-muted hover:text-cyan transition-colors"><Copy size={12} /></button>
        </div>
      )}

      <div className="mt-3">
        <Button variant="ghost" size="sm" onClick={handleReveal} loading={isFetching} className="w-full !text-xs">
          {expanded ? <><EyeOff size={11} />Ocultar clave</> : <><Eye size={11} />Ver clave</>}
        </Button>
      </div>
    </motion.div>
  )
}

// ── Grouped Grid ──────────────────────────────────────────────────────────────
function GroupedGrid<T>({ items, getCategory, renderItem }: {
  items: T[]; getCategory: (i: T) => string; renderItem: (i: T) => React.ReactNode
}) {
  const groups = items.reduce((acc, i) => {
    const cat = getCategory(i) || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(i)
    return acc
  }, {} as Record<string, T[]>)

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([cat, list]) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen size={12} className="text-text-muted" />
            <span className="font-mono text-[10px] text-text-muted uppercase tracking-wide">{cat}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {list.map(renderItem)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Create forms ──────────────────────────────────────────────────────────────
function CreatePasswordForm({ onSuccess, onCancel, categories }: { onSuccess: () => void; onCancel: () => void; categories: string[] }) {
  const [f, setF] = useState({ title: '', username: '', password: '', url: '', notes: '', category: 'general' })
  const [showPwd, setShowPwd] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }))
  const mut = useMutation({ mutationFn: passwordsApi.create, onSuccess: () => { toast.success('Contraseña guardada'); onSuccess() } })

  return (
    <form onSubmit={e => { e.preventDefault(); mut.mutate({ title: f.title, username: f.username || undefined, password: f.password, url: f.url || undefined, notes: f.notes || undefined, category: f.category }) }} className="space-y-3">
      <FormField label="Título *"><Input value={f.title} onChange={set('title')} placeholder="Nombre del servicio" required /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Usuario"><Input value={f.username} onChange={set('username')} placeholder="usuario@email.com" /></FormField>
        <FormField label="Categoría">
          <Input value={f.category} onChange={set('category')} placeholder="general" list="vault-categories" />
          <datalist id="vault-categories">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
        </FormField>
      </div>
      <FormField label="Contraseña *">
        <div className="relative">
          <Input type={showPwd ? 'text' : 'password'} value={f.password} onChange={set('password')} placeholder="••••••••" required />
          <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">{showPwd ? <EyeOff size={14} /> : <Eye size={14} />}</button>
        </div>
      </FormField>
      <FormField label="URL"><Input type="url" value={f.url} onChange={set('url')} placeholder="https://..." /></FormField>
      <FormField label="Notas"><Textarea value={f.notes} onChange={set('notes')} rows={2} placeholder="Notas opcionales..." /></FormField>
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={mut.isPending} className="flex-1">Guardar contraseña</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}

function CreateOTPForm({ onSuccess, onCancel, categories }: { onSuccess: () => void; onCancel: () => void; categories: string[] }) {
  const [f, setF] = useState({ title: '', issuer: '', account: '', secret: '', algorithm: 'SHA1', digits: 6, period: 30, category: 'general' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(p => ({ ...p, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))
  const mut = useMutation({ mutationFn: otpApi.create, onSuccess: () => { toast.success('OTP guardado'); onSuccess() } })

  const preview = () => {
    if (!f.secret) return ''
    try {
      const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(f.secret.trim().toUpperCase()), algorithm: f.algorithm as any, digits: f.digits, period: f.period })
      return totp.generate()
    } catch { return 'Secreto inválido' }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); mut.mutate({ title: f.title, issuer: f.issuer || undefined, account: f.account || undefined, secret: f.secret, algorithm: f.algorithm, digits: f.digits, period: f.period, category: f.category }) }} className="space-y-3">
      <FormField label="Título *"><Input value={f.title} onChange={set('title')} placeholder="Google Workspace" required /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Emisor"><Input value={f.issuer} onChange={set('issuer')} placeholder="Google" /></FormField>
        <FormField label="Cuenta"><Input value={f.account} onChange={set('account')} placeholder="user@domain.com" /></FormField>
      </div>
      <FormField label="Secret Base32 *">
        <Input value={f.secret} onChange={set('secret')} placeholder="JBSWY3DPEHPK3PXP" required className="font-mono tracking-wide" />
      </FormField>
      {f.secret && (
        <div className="bg-base border border-cyan/20 rounded px-3 py-2 flex items-center gap-3">
          <CheckCircle2 size={13} className="text-cyan flex-shrink-0" />
          <span className="font-mono text-sm text-cyan tracking-[0.25em]">{preview()}</span>
          <span className="text-[10px] font-mono text-text-muted">código actual</span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Algoritmo">
          <Select value={f.algorithm} onChange={set('algorithm')}>
            <option value="SHA1">SHA1</option><option value="SHA256">SHA256</option><option value="SHA512">SHA512</option>
          </Select>
        </FormField>
        <FormField label="Dígitos"><Input type="number" value={f.digits} onChange={set('digits')} min={6} max={8} /></FormField>
        <FormField label="Período (s)"><Input type="number" value={f.period} onChange={set('period')} min={15} max={60} /></FormField>
      </div>
      <FormField label="Categoría">
        <Input value={f.category} onChange={set('category')} placeholder="general" list="vault-categories" />
        <datalist id="vault-categories">
          {categories.map(c => <option key={c} value={c} />)}
        </datalist>
      </FormField>
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={mut.isPending} className="flex-1">Guardar OTP</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}

function CreateKeyForm({ onSuccess, onCancel, categories }: { onSuccess: () => void; onCancel: () => void; categories: string[] }) {
  const [f, setF] = useState({ title: '', key_type: 'api_key' as KeyType, content: '', description: '', expires_at: '', category: 'general' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }))
  const mut = useMutation({ mutationFn: securityKeysApi.create, onSuccess: () => { toast.success('Clave guardada'); onSuccess() } })

  return (
    <form onSubmit={e => { e.preventDefault(); mut.mutate({ title: f.title, key_type: f.key_type, content: f.content, description: f.description || undefined, expires_at: f.expires_at || undefined, category: f.category }) }} className="space-y-3">
      <FormField label="Título *"><Input value={f.title} onChange={set('title')} placeholder="Nombre de la clave" required /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Tipo">
          <Select value={f.key_type} onChange={set('key_type') as any}>
            {(Object.entries(KEY_TYPE_LABEL) as [KeyType, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </FormField>
        <FormField label="Categoría">
          <Input value={f.category} onChange={set('category')} placeholder="general" list="vault-categories" />
          <datalist id="vault-categories">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
        </FormField>
      </div>
      <FormField label="Contenido *">
        <Textarea value={f.content} onChange={set('content')} rows={5}
          placeholder={f.key_type === 'ssh_private' ? '-----BEGIN OPENSSH PRIVATE KEY-----\n...' : f.key_type === 'api_key' ? 'sk-xxxxxxxxxxxxxxxx' : 'Contenido de la clave...'}
          required className="font-mono text-xs" />
      </FormField>
      <FormField label="Descripción"><Input value={f.description} onChange={set('description')} placeholder="Descripción opcional" /></FormField>
      <FormField label="Fecha de vencimiento"><Input type="date" value={f.expires_at} onChange={set('expires_at')} /></FormField>
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={mut.isPending} className="flex-1">Guardar clave</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}

// ── Create Modal ──────────────────────────────────────────────────────────────
function CreateModal({ open, onClose, defaultTab, onSuccess, categories }: {
  open: boolean; onClose: () => void; defaultTab: Tab; onSuccess: (qk: string) => void; categories: string[]
}) {
  const [tab, setTab] = useState<Tab>(defaultTab)
  useEffect(() => { if (open) setTab(defaultTab) }, [open, defaultTab])

  return (
    <Modal open={open} onClose={onClose} title="Nueva entrada de seguridad" width="max-w-lg">
      <div className="flex gap-1 mb-5 bg-base border border-border rounded-lg p-1">
        {([['passwords', 'Contraseña', KeyRound], ['otp', 'OTP / 2FA', Shield], ['keys', 'Clave', Key]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id as Tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-sans transition-all ${tab === id ? 'bg-elevated border border-border text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>
      {tab === 'passwords' && <CreatePasswordForm onSuccess={() => onSuccess('passwords')} onCancel={onClose} categories={categories} />}
      {tab === 'otp' && <CreateOTPForm onSuccess={() => onSuccess('otp')} onCancel={onClose} categories={categories} />}
      {tab === 'keys' && <CreateKeyForm onSuccess={() => onSuccess('seckeys')} onCancel={onClose} categories={categories} />}
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function PasswordsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('passwords')
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const canManage = user?.role === 'admin' || user?.role === 'supervisor'

  const { data: passwords = [], isLoading: lPwd } = useQuery({ queryKey: ['passwords'], queryFn: () => passwordsApi.list().then(r => r.data) })
  const { data: otps = [], isLoading: lOtp } = useQuery({ queryKey: ['otp'], queryFn: () => otpApi.list().then(r => r.data) })
  const { data: seckeys = [], isLoading: lKeys } = useQuery({ queryKey: ['seckeys'], queryFn: () => securityKeysApi.list().then(r => r.data) })
  const { data: categoriesValue } = useQuery({
    queryKey: ['public-setting', 'vault_categories'],
    queryFn: () => settingsApi.getPublic('vault_categories').then((r) => r.data.value),
  })

  const categories = Array.isArray(categoriesValue) && categoriesValue.every((x) => typeof x === 'string')
    ? (categoriesValue as string[])
    : ['general']

  const delPwd = useMutation({ mutationFn: passwordsApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ['passwords'] }); toast.success('Eliminado') } })
  const delOtp = useMutation({ mutationFn: otpApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ['otp'] }); toast.success('Eliminado') } })
  const delKey = useMutation({ mutationFn: securityKeysApi.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ['seckeys'] }); toast.success('Eliminado') } })

  if (lPwd || lOtp || lKeys) return <PageLoader />

  const sl = search.toLowerCase()
  const fPwd = passwords.filter(p => p.title.toLowerCase().includes(sl) || (p.username ?? '').toLowerCase().includes(sl))
  const fOtp = otps.filter(o => o.title.toLowerCase().includes(sl) || (o.issuer ?? '').toLowerCase().includes(sl))
  const fKeys = seckeys.filter(k => k.title.toLowerCase().includes(sl))

  return (
    <div className="animate-fade-in">
      <PageHeader title="Bóveda de Seguridad" subtitle="Contraseñas, OTP y claves centralizadas" icon={<Lock size={16} />}
        action={canManage ? <Button onClick={() => setShowCreate(true)} size="sm"><Plus size={14} />Agregar</Button> : undefined} />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-panel border border-border rounded-lg p-1 w-fit">
        {([
          { id: 'passwords' as Tab, label: 'Contraseñas', count: passwords.length, Icon: KeyRound, color: 'text-green-op' },
          { id: 'otp' as Tab, label: 'OTP / 2FA', count: otps.length, Icon: Shield, color: 'text-cyan' },
          { id: 'keys' as Tab, label: 'Claves de Seguridad', count: seckeys.length, Icon: Key, color: 'text-amber-op' },
        ]).map(({ id, label, count, Icon, color }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-sans transition-all ${tab === id ? 'bg-elevated border border-border-bright text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}>
            <Icon size={13} className={tab === id ? color : 'text-text-muted'} />
            {label}
            <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${tab === id ? 'bg-cyan/10 text-cyan' : 'bg-elevated text-text-muted'}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
          className="w-full bg-panel border border-border rounded pl-9 pr-3 py-2 text-sm font-sans text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan/60 focus:ring-1 focus:ring-cyan/20 transition-colors" />
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === 'passwords' && (
          <motion.div key="pwd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {fPwd.length === 0
              ? <EmptyState icon={<KeyRound size={32} />} label="No hay contraseñas" onAdd={canManage ? () => setShowCreate(true) : undefined} />
              : <GroupedGrid items={fPwd} getCategory={i => i.category} renderItem={p => <PasswordCard key={p.id} entry={p} canManage={canManage} onDelete={() => delPwd.mutate(p.id)} />} />}
          </motion.div>
        )}
        {tab === 'otp' && (
          <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {fOtp.length === 0
              ? <EmptyState icon={<Shield size={32} />} label="No hay entradas OTP" onAdd={canManage ? () => setShowCreate(true) : undefined} />
              : <GroupedGrid items={fOtp} getCategory={i => i.category} renderItem={o => <OTPCard key={o.id} entry={o} canManage={canManage} onDelete={() => delOtp.mutate(o.id)} />} />}
          </motion.div>
        )}
        {tab === 'keys' && (
          <motion.div key="keys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {fKeys.length === 0
              ? <EmptyState icon={<Key size={32} />} label="No hay claves de seguridad" onAdd={canManage ? () => setShowCreate(true) : undefined} />
              : <GroupedGrid items={fKeys} getCategory={i => i.category} renderItem={k => <SecKeyCard key={k.id} entry={k} canManage={canManage} onDelete={() => delKey.mutate(k.id)} />} />}
          </motion.div>
        )}
      </AnimatePresence>

      <CreateModal open={showCreate} onClose={() => setShowCreate(false)} defaultTab={tab} categories={categories}
        onSuccess={qk => { qc.invalidateQueries({ queryKey: [qk] }); setShowCreate(false) }} />
    </div>
  )
}

function EmptyState({ icon, label, onAdd }: { icon: React.ReactNode; label: string; onAdd?: () => void }) {
  return (
    <div className="py-16 text-center">
      <div className="text-text-muted mx-auto mb-3 flex justify-center">{icon}</div>
      <p className="font-sans text-sm text-text-secondary mb-3">{label}</p>
      {onAdd && <Button size="sm" onClick={onAdd}><Plus size={13} />Agregar primero</Button>}
    </div>
  )
}

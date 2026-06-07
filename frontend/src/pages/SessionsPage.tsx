import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, Plus, Zap, X, CheckCircle2, AlertTriangle, ExternalLink, Copy, Key, Building2, FileText, Download, Clock, CircleDot, Paperclip } from 'lucide-react'
import { sessionsApi, assetsApi, branchesApi, settingsApi } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea, FormField } from '../components/ui/Input'
import { PageLoader } from '../components/ui/Spinner'
import { TOOL_META, type ToolId } from '../components/ToolLogos'
import type { SessionCreateIn, SessionCloseIn, SessionResult, RemoteTool, SupportSession } from '../api/types'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const toolLabel: Record<RemoteTool, string> = { anydesk: 'AnyDesk', rustdesk: 'RustDesk', teamviewer: 'TeamViewer', ultravnc: 'UltraVNC', rdp: 'Remote Desktop' }
const resultLabel: Record<SessionResult, string> = {
  resuelto: 'Resuelto', pendiente: 'Pendiente', escalado: 'Escalado', no_se_pudo_acceder: 'Sin acceso'
}

function statusBadge(s: SupportSession) {
  if (s.status === 'closed') {
    if (s.result === 'resuelto') return <Badge variant="green" dot>Resuelto</Badge>
    if (s.result === 'escalado') return <Badge variant="amber" dot>Escalado</Badge>
    if (s.result === 'no_se_pudo_acceder') return <Badge variant="red" dot>Sin acceso</Badge>
    return <Badge variant="muted" dot>Cerrado</Badge>
  }
  if (s.status === 'in_progress') return <Badge variant="cyan" dot>En progreso</Badge>
  return <Badge variant="muted" dot>Creado</Badge>
}

export function SessionsPage() {
  const qc = useQueryClient()
  const { can } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [closing, setClosing] = useState<SupportSession | null>(null)
  const [connecting, setConnecting] = useState<SupportSession | null>(null)
  const [reporting, setReporting] = useState<SupportSession | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions', filterStatus],
    queryFn: () => sessionsApi.list(filterStatus ? { status: filterStatus } : {}).then(r => r.data),
  })
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => assetsApi.list().then(r => r.data) })
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list().then(r => r.data) })

  const create = useMutation({
    mutationFn: (d: SessionCreateIn) => sessionsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sessions'] }); setShowCreate(false) },
  })

  const connect = useMutation({
    mutationFn: (id: number) => sessionsApi.connect(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      setConnecting(null)
    },
  })

  const secretsQ = useQuery({
    queryKey: ['asset-remote-secrets', connecting?.asset_id],
    queryFn: () => assetsApi.remoteSecrets(Number(connecting?.asset_id)).then((r) => r.data),
    enabled: !!connecting?.asset_id && can('assets.reveal'),
  })

  const closeSession = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SessionCloseIn }) => sessionsApi.close(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sessions'] }); setClosing(null) },
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sesiones"
        subtitle={`${sessions.length} sesiones`}
        icon={<ClipboardList size={16} />}
        action={<Button onClick={() => setShowCreate(true)} size="sm"><Plus size={14} />Nueva sesión</Button>}
      />

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {['', 'created', 'in_progress', 'closed'].map(v => (
          <button
            key={v}
            onClick={() => setFilterStatus(v)}
            className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wide transition-all ${
              filterStatus === v
                ? 'bg-cyan/10 text-cyan border border-cyan/30'
                : 'bg-panel text-text-secondary border border-border hover:border-border-bright'
            }`}
          >
            {v === '' ? 'Todas' : v === 'created' ? 'Creadas' : v === 'in_progress' ? 'En progreso' : 'Cerradas'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        {sessions.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList size={36} className="text-text-muted mx-auto mb-3" />
            <p className="font-sans text-sm text-text-secondary">No hay sesiones con este filtro.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['#', 'Activo', 'Herramienta', 'Motivo', 'Estado', 'Inicio', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-sans font-medium text-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {sessions.map((s, i) => {
                  const asset = assets.find(a => a.id === s.asset_id)
                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-elevated/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">#{s.id}</td>
                      <td className="px-4 py-3 font-sans text-sm text-text-primary">{asset?.name ?? `#${s.asset_id}`}</td>
                      <td className="px-4 py-3 font-mono text-xs text-cyan uppercase">{toolLabel[s.tool]}</td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="font-sans text-xs text-text-secondary truncate">{s.reason}</p>
                      </td>
                      <td className="px-4 py-3">{statusBadge(s)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-text-secondary whitespace-nowrap">
                        {new Date(s.start_at).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {s.status === 'created' && (
                            <Button size="sm" variant="outline" onClick={() => setConnecting(s)}>
                              <Zap size={12} />Conectar
                            </Button>
                          )}
                          {s.status === 'in_progress' && (
                            <Button size="sm" variant="danger" onClick={() => setClosing(s)}>
                              <X size={12} />Cerrar
                            </Button>
                          )}
                          {s.status === 'closed' && (
                            <Button size="sm" variant="outline" onClick={() => setReporting(s)}>
                              <FileText size={12} />Ver reporte
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nueva Sesión de Soporte">
        <CreateSessionForm
          assets={assets}
          branches={branches}
          onSave={(d) => create.mutate(d)}
          onCancel={() => setShowCreate(false)}
          loading={create.isPending}
          error={create.error as Error | null}
        />
      </Modal>

      {/* Connect modal */}
      <Modal open={!!connecting} onClose={() => setConnecting(null)} title="Conexión Remota" width="max-w-lg">
        {connecting && (
          <ConnectModal
            session={connecting}
            asset={assets.find(a => a.id === connecting.asset_id)}
            secrets={secretsQ.data}
            onConnect={() => connect.mutate(connecting.id)}
            onClose={() => setConnecting(null)}
            isPending={connect.isPending}
            error={connect.error as Error | null}
          />
        )}
      </Modal>

      {/* Close modal */}
      <Modal open={!!closing} onClose={() => setClosing(null)} title="Cerrar Sesion">
        {closing && (
          <CloseSessionForm
            session={closing}
            assetName={assets.find(a => a.id === closing.asset_id)?.name}
            onSave={(d) => closeSession.mutate({ id: closing.id, data: d })}
            onCancel={() => setClosing(null)}
            loading={closeSession.isPending}
          />
        )}
      </Modal>

      {/* Report modal */}
      <Modal open={!!reporting} onClose={() => setReporting(null)} title="Reporte de Sesion" width="max-w-2xl">
        {reporting && (
          <SessionReportModal
            session={reporting}
            onClose={() => setReporting(null)}
          />
        )}
      </Modal>
    </div>
  )
}

function CreateSessionForm({ assets, branches, onSave, onCancel, loading, error }: {
  assets: import('../api/types').Asset[]
  branches: import('../api/types').Branch[]
  onSave: (d: SessionCreateIn) => void
  onCancel: () => void
  loading: boolean
  error: Error | null
}) {
  const [branchId, setBranchId] = useState<number | 'unassigned'>('unassigned')
  const [assetId, setAssetId] = useState<number>(0)
  const [tool, setTool] = useState<RemoteTool>('anydesk')
  const [reason, setReason] = useState('')
  const [ticket, setTicket] = useState('')
  const [assetQuery, setAssetQuery] = useState('')

  const { data: minReasonVal } = useQuery({
    queryKey: ['public-setting', 'session_min_reason_length'],
    queryFn: () => settingsApi.getPublic('session_min_reason_length').then((r) => r.data.value),
  })

  const minReasonLength = typeof minReasonVal === 'number' ? minReasonVal : 20

  const filteredAssets = assets.filter(a => {
    if (branchId === 'unassigned') return a.branch_id === null
    return a.branch_id === branchId
  })

  const q = assetQuery.trim().toLowerCase()
  const visibleAssets = q
    ? filteredAssets.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        (a.hostname ?? '').toLowerCase().includes(q) ||
        (a.ip ?? '').toLowerCase().includes(q)
      )
    : filteredAssets

  const selectedAsset = assets.find(a => a.id === Number(assetId))

  const getToolInfo = (a: typeof selectedAsset): { tool: RemoteTool; id: string }[] => {
    if (!a) return []
    return [
      ...(a.anydesk_id ? [{ tool: 'anydesk' as RemoteTool, id: a.anydesk_id }] : []),
      ...(a.rustdesk_id ? [{ tool: 'rustdesk' as RemoteTool, id: a.rustdesk_id }] : []),
      ...(a.teamviewer_id ? [{ tool: 'teamviewer' as RemoteTool, id: a.teamviewer_id }] : []),
      ...(a.vnc_host ? [{ tool: 'ultravnc' as RemoteTool, id: `${a.vnc_host}:${a.vnc_port}` }] : []),
      ...(a.rdp_host ? [{ tool: 'rdp' as RemoteTool, id: `${a.rdp_host}:${a.rdp_port}` }] : []),
    ]
  }

  const availableTools = getToolInfo(selectedAsset)

  useEffect(() => {
    if (filteredAssets.length > 0 && !filteredAssets.find(a => a.id === assetId)) {
      setAssetId(filteredAssets[0].id)
      const tools = getToolInfo(filteredAssets[0])
      if (tools.length > 0) setTool(tools[0].tool)
      return
    }
    if (filteredAssets.length === 0) setAssetId(0)
  }, [branchId])

  useEffect(() => {
    if (availableTools.length > 0 && !availableTools.find(t => t.tool === tool)) {
      setTool(availableTools[0].tool)
    }
  }, [selectedAsset?.id])

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ asset_id: Number(assetId), tool, reason, ticket: ticket || undefined }) }} className="space-y-4">
      <FormField label="Sucursal *">
        <Select value={branchId} onChange={e => {
          const val = e.target.value
          setBranchId(val === 'unassigned' ? 'unassigned' : Number(val))
        }}>
          <option value="unassigned">Sin asignar</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </FormField>

      <FormField label="Activo *">
        <div className="space-y-2">
          <Input value={assetQuery} onChange={(e) => setAssetQuery(e.target.value)} placeholder="Buscar activo por nombre, hostname o IP..." />
        <Select value={assetId} onChange={e => {
          const newId = Number(e.target.value)
          setAssetId(newId)
          const tools = getToolInfo(assets.find(a => a.id === newId))
          if (tools.length > 0) setTool(tools[0].tool)
        }}>
          {visibleAssets.length === 0 && <option value={0}>No hay equipos con ese filtro</option>}
          {visibleAssets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        </div>
      </FormField>

      <div className="space-y-1.5">
        <label className="text-xs font-mono text-text-secondary uppercase tracking-widest">Herramienta de conexión *</label>
        {availableTools.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {availableTools.map(({ tool: t, id }) => {
              const meta = TOOL_META[t as ToolId]
              const active = tool === t
              if (!meta) return null
              const { Logo } = meta
              return (
                <button key={t} type="button" onClick={() => setTool(t)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                    active ? `${meta.bgColor} ${meta.borderColor} shadow-sm` : 'border-border bg-elevated hover:border-border-bright'
                  }`}>
                  <Logo size={28} />
                  <div className="min-w-0">
                    <p className={`text-xs font-display font-semibold ${active ? meta.color : 'text-text-primary'}`}>{meta.label}</p>
                    <p className="text-[10px] font-mono text-text-muted truncate">{id}</p>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-amber-op bg-amber-op/5 border border-amber-op/20 rounded px-3 py-2">
            Este activo no tiene herramientas de acceso remoto configuradas.
          </p>
        )}
      </div>
      <FormField label={`Motivo * (mín. ${minReasonLength} chars — ${reason.length}/${minReasonLength})`}>
        <Textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Describe el motivo de la conexión remota..."
          required
          minLength={minReasonLength}
        />
      </FormField>
      <FormField label="Ticket / Referencia">
        <Input value={ticket} onChange={e => setTicket(e.target.value)} placeholder="TICK-001 (opcional)" />
      </FormField>

      {error && (
        <p className="text-xs text-red-op bg-red-op/10 border border-red-op/20 rounded px-3 py-2">
          {(error as any)?.response?.data?.detail ?? error.message}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading} disabled={assetId === 0 || availableTools.length === 0 || reason.trim().length < minReasonLength} className="flex-1">Crear sesión</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}

function ConnectModal({ session, asset, secrets, onConnect, onClose, isPending, error }: {
  session: SupportSession
  asset: import('../api/types').Asset | undefined
  secrets: { anydesk_password: string | null; rustdesk_password: string | null; teamviewer_password: string | null } | undefined
  onConnect: () => void
  onClose: () => void
  isPending: boolean
  error: Error | null
}) {
  if (!asset) {
    return <p className="text-sm text-text-secondary">Activo no encontrado.</p>
  }

  const copy = (text: string) => navigator.clipboard.writeText(text)

  const toolId = session.tool as ToolId
  const meta = TOOL_META[toolId]

  let idValue = ''
  let passValue: string | null = null
  let uri = ''

  if (toolId === 'anydesk') {
    idValue = asset.anydesk_id ?? ''
    passValue = secrets?.anydesk_password ?? null
    uri = `anydesk:${idValue}`
  } else if (toolId === 'rustdesk') {
    idValue = asset.rustdesk_id ?? ''
    passValue = secrets?.rustdesk_password ?? null
    uri = `rustdesk://connection/new/${idValue}`
  } else if (toolId === 'teamviewer') {
    idValue = asset.teamviewer_id ?? ''
    passValue = secrets?.teamviewer_password ?? null
    uri = `teamviewer10://control?partner=${idValue}`
  } else if (toolId === 'ultravnc') {
    idValue = asset.vnc_host ? `${asset.vnc_host}:${asset.vnc_port}` : ''
    passValue = null
    uri = `vnc://${idValue}`
  } else if (toolId === 'rdp') {
    idValue = asset.rdp_host ? `${asset.rdp_host}:${asset.rdp_port}` : ''
    passValue = asset.rdp_username
    uri = `rdp://${idValue}`
  }

  return (
    <div className="space-y-4">
      <div className="bg-elevated rounded-lg px-4 py-3 border border-border text-center">
        <p className="text-[10px] font-mono text-text-muted mb-1">ACTIVO / SESIÓN</p>
        <p className="font-sans text-sm text-text-primary">{asset.name} — #{session.id}</p>
      </div>

      <div className={`rounded-xl border ${meta.borderColor} ${meta.bgColor} p-5 flex flex-col items-center gap-4`}>
        <meta.Logo size={56} />
        <p className={`text-sm font-display font-semibold ${meta.color}`}>{meta.label}</p>

        <div className="w-full bg-base/60 rounded-lg px-3 py-2 text-center">
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-0.5">ID / Host</p>
          <code className="text-base font-mono text-text-primary">{idValue}</code>
        </div>

        {passValue && (
          <div className="w-full bg-base/60 rounded-lg px-3 py-2 flex items-center gap-2">
            <Key size={14} className="text-text-muted flex-shrink-0" />
            <input
              type="text"
              value={passValue}
              readOnly
              className="bg-transparent text-sm font-mono text-text-secondary flex-1 outline-none"
            />
            <button type="button" onClick={() => copy(passValue)} className="text-text-muted hover:text-cyan transition-colors">
              <Copy size={14} />
            </button>
          </div>
        )}

        <a
          href={uri}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded font-sans transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan/40 bg-transparent text-cyan border border-cyan/40 hover:border-cyan hover:bg-cyan/5 px-6 py-3 text-base w-full"
        >
          <ExternalLink size={16} />Abrir {meta.label}
        </a>
      </div>

      {error && (
        <p className="text-xs text-red-op bg-red-op/10 border border-red-op/20 rounded px-3 py-2">
          {(error as any)?.response?.data?.detail ?? error.message}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button onClick={onConnect} loading={isPending} className="flex-1">
          <Zap size={14} />Conectar y abrir
        </Button>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  )
}

function CloseSessionForm({ session, assetName, onSave, onCancel, loading }: {
  session: SupportSession
  assetName?: string
  onSave: (d: SessionCloseIn) => void
  onCancel: () => void
  loading: boolean
}) {
  const [result, setResult] = useState<SessionResult>('resuelto')
  const [summary, setSummary] = useState('')

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ result, summary }) }} className="space-y-4">
      <div className="bg-elevated rounded-lg px-4 py-3 border border-border">
        <p className="text-xs font-mono text-text-muted mb-1">ACTIVO / SESIÓN</p>
        <p className="font-sans text-sm text-text-primary">{assetName ?? `#${session.asset_id}`} — #{session.id}</p>
        <p className="font-mono text-xs text-cyan mt-1">{toolLabel[session.tool]}</p>
      </div>
      <FormField label="Resultado *">
        <Select value={result} onChange={e => setResult(e.target.value as SessionResult)}>
          {(Object.entries(resultLabel) as [SessionResult, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </FormField>
      <FormField label={`Resumen * (mín. 30 chars — ${summary.length}/30)`}>
        <Textarea
          value={summary}
          onChange={e => setSummary(e.target.value)}
          rows={4}
          placeholder="Describe lo que se realizó durante la sesión..."
          required
          minLength={30}
        />
      </FormField>
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading} className="flex-1">
          <CheckCircle2 size={14} />Cerrar sesión
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}


function SessionReportModal({ session, onClose }: { session: SupportSession; onClose: () => void }) {
  const { data: report, isLoading } = useQuery({
    queryKey: ['session-report', session.id],
    queryFn: () => sessionsApi.getReport(session.id).then(r => r.data),
  })
  const [downloading, setDownloading] = useState(false)

  const handleDownloadPdf = async () => {
    setDownloading(true)
    try {
      const r = await sessionsApi.downloadReportPdf(session.id)
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte_sesion_${session.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar PDF')
    } finally {
      setDownloading(false)
    }
  }

  const resultLabel: Record<string, string> = {
    resuelto: 'Resuelto', pendiente: 'Pendiente', escalado: 'Escalado', no_se_pudo_acceder: 'Sin acceso'
  }
  const toolLabel: Record<string, string> = {
    anydesk: 'AnyDesk', rustdesk: 'RustDesk', teamviewer: 'TeamViewer', ultravnc: 'UltraVNC', rdp: 'Remote Desktop'
  }
  const eventLabel: Record<string, string> = {
    SESSION_CREATED: 'Sesion creada',
    CONNECT_CLICKED: 'Conexion iniciada',
    SESSION_CLOSED: 'Sesion cerrada',
    ATTACHMENT_ADDED: 'Archivo adjunto',
    ATTACHMENT_DOWNLOADED: 'Archivo descargado',
  }
  const eventColor: Record<string, string> = {
    SESSION_CREATED: 'text-cyan',
    CONNECT_CLICKED: 'text-amber-400',
    SESSION_CLOSED: 'text-green-400',
    ATTACHMENT_ADDED: 'text-purple-400',
    ATTACHMENT_DOWNLOADED: 'text-text-muted',
  }

  if (isLoading) return <div className="text-text-muted text-sm text-center py-8">Cargando reporte...</div>
  if (!report) return <div className="text-red-400 text-sm text-center py-8">Error al cargar el reporte</div>

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-elevated rounded-lg px-4 py-3 border border-border">
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">Activo</p>
          <p className="text-sm font-sans text-text-primary font-medium">{report.asset_name}</p>
        </div>
        <div className="bg-elevated rounded-lg px-4 py-3 border border-border">
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">Tecnico</p>
          <p className="text-sm font-sans text-text-primary font-medium">{report.creator_username}</p>
        </div>
        <div className="bg-elevated rounded-lg px-4 py-3 border border-border">
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">Herramienta</p>
          <p className="text-sm font-sans text-text-primary">{toolLabel[report.session.tool] ?? report.session.tool}</p>
        </div>
        <div className="bg-elevated rounded-lg px-4 py-3 border border-border">
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">Resultado</p>
          <p className="text-sm font-sans text-text-primary">{report.session.result ? resultLabel[report.session.result] ?? report.session.result : '-'}</p>
        </div>
      </div>

      {/* Dates */}
      <div className="flex gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1"><Clock size={12} /> Inicio: {new Date(report.session.start_at).toLocaleString('es')}</span>
        {report.session.end_at && <span className="flex items-center gap-1"><Clock size={12} /> Fin: {new Date(report.session.end_at).toLocaleString('es')}</span>}
      </div>

      {/* Summary */}
      {report.session.summary && (
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Resumen / Bitacora</p>
          <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{report.session.summary}</p>
        </div>
      )}

      {/* Timeline */}
      {report.events.length > 0 && (
        <div>
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-3">Historial de eventos</p>
          <div className="relative pl-4 border-l border-border space-y-4">
            {report.events.map((ev, i) => (
              <div key={ev.id} className="relative">
                <div className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-panel border-2 border-cyan" />
                <div className="text-xs">
                  <p className="text-[10px] text-text-muted font-mono">{new Date(ev.at).toLocaleString('es')}</p>
                  <p className={`font-medium ${eventColor[ev.type] ?? 'text-text-primary'}`}>
                    {eventLabel[ev.type] ?? ev.type.replace(/_/g, ' ')}
                  </p>
                  {ev.metadata_json && (
                    <p className="text-text-muted mt-0.5">{ev.metadata_json}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      {report.attachments.length > 0 && (
        <div>
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Archivos adjuntos</p>
          <div className="space-y-1.5">
            {report.attachments.map(att => (
              <div key={att.id} className="flex items-center gap-2 text-xs text-text-secondary bg-elevated rounded px-3 py-2 border border-border">
                <Paperclip size={12} className="text-text-muted" />
                <span className="flex-1 truncate">{att.filename}</span>
                <span className="text-text-muted font-mono">{(att.size / 1024).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t border-border">
        <Button onClick={handleDownloadPdf} loading={downloading} className="flex-1">
          <Download size={14} /> Descargar PDF
        </Button>
        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  )
}

import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Printer, RefreshCw, Search, Settings2, FileBarChart2, Copy, ChevronRight, ChevronUp,
  AlertTriangle, CheckCircle2, Clock, WifiOff, Plus, Trash2,
  ExternalLink, MonitorSmartphone,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { AxiosError } from 'axios'
import { printersApi, assetsApi, branchesApi } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Textarea, Select, FormField } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { useAuth } from '../context/AuthContext'
import type { Asset, Branch, DgiConfig, FiscalEquipo, FiscalMapping, PrinterEstado } from '../api/types'

type Row = FiscalEquipo & { mapping?: FiscalMapping; zLive?: { z_number?: string; z_date?: string; cached?: boolean } }

const ESTADO_BADGE: Record<PrinterEstado, 'green' | 'amber' | 'red'> = {
  Actualizado: 'green',
  Pendiente: 'amber',
  Crítico: 'red',
}

function errDetail(e: unknown): string {
  const ax = e as AxiosError<{ detail?: string }>
  return ax?.response?.data?.detail || (e as Error)?.message || 'Error desconocido'
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function Kpi({ label, value, accent, Icon }: { label: string; value: number; accent: string; Icon: any }) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${accent}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="font-display font-bold text-2xl text-text-primary leading-none">{value}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted mt-1">{label}</p>
      </div>
    </div>
  )
}

// ── Detail view (panel completo al seleccionar un equipo) ────────────────────
function Section({ title, children, accent = 'border-border' }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className={`bg-panel border ${accent} rounded-lg p-4`}>
      <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-3">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function DetailPanel({ row, assets, branches, sucursales, estadoOptions, diagnostics, canManage, onClose, onSaved, onZResult }: {
  row: Row; assets: Asset[]; branches: Branch[]; sucursales: string[]; estadoOptions: string[]; diagnostics: string[]; canManage: boolean
  onClose: () => void; onSaved: () => void; onZResult: (serie: string, z: { z_number?: string; z_date?: string; cached?: boolean }) => void
}) {
  const navigate = useNavigate()
  const m: Partial<FiscalMapping> = row.mapping || {}
  const [f, setF] = useState({
    sucursal: m.sucursal || '', caja: m.caja || '', sistema: m.sistema || '',
    estadoInterno: m.estadoInterno || '',
    assetId: m.assetId ? String(m.assetId) : '',
    mantenimientoUltimo: m.mantenimientoUltimo || '', mantenimientoProximo: m.mantenimientoProximo || '',
    alertaNota: m.alertaNota || '', manualDiagnosis: m.manualDiagnosis || '', zNota: m.zNota || '',
  })
  const [branchSel, setBranchSel] = useState<string>(() => {
    const a = assets.find(x => x.id === Number(m.assetId))
    return a ? (a.branch_id != null ? String(a.branch_id) : 'unassigned') : 'all'
  })
  const [z, setZ] = useState<{ z_number?: string; z_date?: string; cached?: boolean }>({
    z_number: row.zLive?.z_number ?? (row.ultimaZ !== 'N/A' ? row.ultimaZ : undefined),
    z_date: row.zLive?.z_date ?? (row.ultimoReporteZ !== 'N/A' ? row.ultimoReporteZ : undefined),
    cached: row.zLive?.cached,
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }))
  const ro = !canManage

  const save = useMutation({
    mutationFn: () => printersApi.saveMappings([{ serie: row.serie, ...f }]),
    onSuccess: () => { toast.success('Cambios guardados'); onSaved() },
    onError: (e) => toast.error(errDetail(e)),
  })
  const zMut = useMutation({
    mutationFn: () => printersApi.zreport({ serial: row.serie, machineId: row.machineId, taxpayerId: row.taxpayerId, transmission: row.ultima_transmision, days: 30 }).then(r => r.data),
    onSuccess: (data) => {
      if (data.success) {
        const z2 = { z_number: data.z_number, z_date: data.z_date, cached: data.cached }
        setZ(z2); onZResult(row.serie, z2)
        toast.success(`Z ${data.z_number || ''} ${data.cached ? '(caché)' : ''}`.trim())
      } else toast.error('No se encontró Reporte Z reciente')
    },
    onError: (e) => toast.error(errDetail(e)),
  })

  const linkedAsset = assets.find(a => a.id === Number(f.assetId))
  const assetsInBranch = assets.filter(a => {
    if (branchSel === 'all') return true
    if (branchSel === 'unassigned') return a.branch_id == null
    return a.branch_id === Number(branchSel)
  })

  const startSession = () => {
    if (!f.assetId) { toast.error('Vincula un activo primero'); return }
    navigate(`/sessions?asset_id=${f.assetId}`)
  }

  const copy = (v: string, label: string) => { if (!v) return; navigator.clipboard.writeText(v); toast.success(`${label} copiado`) }
  const openPlaceft = () => {
    navigator.clipboard.writeText(row.serie).catch(() => {})
    window.open('https://dgi-placef.mef.gob.pa', '_blank', 'noopener')
    toast.success('Serie copiada · abriendo PlaceFT')
  }

  const dgiInhab = (row.estado_dgi || '').toUpperCase().includes('INHAB') || (row.estado_dgi || '').toUpperCase().includes('INACT')

  return (
    <div className="border-t-2 border-cyan/30 bg-elevated/20">
      {/* Toolbar del panel desplegado */}
      <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-b border-border">
        {canManage && <Button size="sm" onClick={() => save.mutate()} loading={save.isPending}>Guardar cambios</Button>}
        <Button size="sm" variant="ghost" onClick={onClose}><ChevronUp size={14} />Cerrar</Button>
      </div>
      {/* Body */}
      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Col 1: Datos del equipo */}
            <Section title="Datos del equipo">
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted">Estado DGI</span>
                <Badge variant={dgiInhab ? 'red' : 'green'}>{dgiInhab ? 'INHABILITADO' : 'ACTIVO'}</Badge>
              </div>
              <div className="flex justify-between text-sm"><span className="text-text-muted">Distribuidor</span><span className="text-text-secondary truncate ml-2">{row.distribuidor || '—'}</span></div>
              <div className="flex justify-between items-center text-sm gap-2">
                <span className="text-text-muted flex-shrink-0">Serial</span>
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-text-primary truncate">{row.serie}</span>
                  <button onClick={() => copy(row.serie, 'Serial')} title="Copiar serial"
                    className="text-text-muted hover:text-cyan transition-colors flex-shrink-0"><Copy size={13} /></button>
                </span>
              </div>
              <FormField label="Sucursal">
                <Input value={f.sucursal} onChange={set('sucursal')} disabled={ro} list="printer-sucursales" placeholder="Buscar o escribir…" />
                <datalist id="printer-sucursales">{sucursales.map(s => <option key={s} value={s} />)}</datalist>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Caja"><Input value={f.caja} onChange={set('caja')} disabled={ro} placeholder="Caja" /></FormField>
                <FormField label="Sistema">
                  <Select value={f.sistema} onChange={set('sistema')} disabled={ro}>
                    <option value="">Sin definir</option>
                    <option value="IMOSOFT">IMOSOFT</option>
                    <option value="ISMART">ISMART</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Estado interno">
                <Input value={f.estadoInterno} onChange={set('estadoInterno')} disabled={ro} list="printer-estados" placeholder="Operativa / En revisión…" />
                <datalist id="printer-estados">{estadoOptions.map(s => <option key={s} value={s} />)}</datalist>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Mant. último"><Input type="date" value={f.mantenimientoUltimo} onChange={set('mantenimientoUltimo')} disabled={ro} /></FormField>
                <FormField label="Mant. próximo"><Input type="date" value={f.mantenimientoProximo} onChange={set('mantenimientoProximo')} disabled={ro} /></FormField>
              </div>
              <FormField label="Alerta / Novedad"><Textarea value={f.alertaNota} onChange={set('alertaNota')} disabled={ro} rows={3} placeholder="Ej: equipo en bodega, error físico, pendiente baja…" /></FormField>
            </Section>

            {/* Col 2: Reporte Z */}
            <Section title="Reporte Z" accent={z.z_number === 'Invalid' ? 'border-red-op/40' : 'border-border'}>
              <div className="flex justify-between items-center">
                <span className="text-text-muted text-sm">Último Z</span>
                <span className={`font-display font-bold text-2xl ${z.z_number === 'Invalid' ? 'text-red-op' : 'text-text-primary'}`}>{z.z_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted text-sm">Fecha Z</span>
                <span className="font-mono text-text-secondary">{z.z_date || 'N/A'}{z.cached ? ' (caché)' : ''}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted text-sm">Última transmisión</span>
                <span className="font-mono text-text-secondary text-xs">{row.ultima_transmision ? row.ultima_transmision.slice(0, 19).replace('T', ' ') : '—'}</span>
              </div>
              <Button variant="outline" className="w-full" onClick={() => zMut.mutate()} loading={zMut.isPending}><FileBarChart2 size={14} />Actualizar Z</Button>
              <Button variant="ghost" className="w-full" onClick={openPlaceft}><ExternalLink size={14} />Ver en PlaceFT</Button>
              {f.zNota && <p className="text-xs text-text-muted border-t border-border pt-2">Nota: {f.zNota}</p>}
            </Section>

            {/* Col 3: Activo vinculado / diagnóstico / notas */}
            <Section title="Activo vinculado y notas">
              <div>
                <p className="text-xs font-mono text-text-secondary uppercase tracking-widest mb-1.5">Activo vinculado</p>
                {linkedAsset ? (
                  <div className="bg-base border border-border rounded p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-sans text-sm text-text-primary truncate">{linkedAsset.name}</p>
                        <p className="font-mono text-[11px] text-text-muted truncate">
                          {[linkedAsset.hostname, linkedAsset.ip].filter(Boolean).join(' · ') || `Activo #${linkedAsset.id}`}
                        </p>
                      </div>
                      {!ro && (
                        <button onClick={() => setF(p => ({ ...p, assetId: '' }))} title="Desvincular"
                          className="text-text-muted hover:text-red-op transition-colors flex-shrink-0"><Trash2 size={14} /></button>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1" onClick={startSession}><MonitorSmartphone size={13} />Nueva sesión / Conectar</Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate('/assets')}>Ver activo</Button>
                    </div>
                    <p className="text-[11px] text-text-muted mt-2">Las conexiones se gestionan en Sesiones y quedan registradas (con motivo).</p>
                  </div>
                ) : (
                  <div className="bg-base border border-dashed border-border rounded p-3 space-y-2">
                    {ro ? (
                      <p className="text-xs text-text-muted">Sin activo vinculado.</p>
                    ) : (
                      <>
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1">Sucursal</p>
                          <Select value={branchSel} onChange={e => setBranchSel(e.target.value)}>
                            <option value="all">Todas las sucursales</option>
                            {branches.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
                            <option value="unassigned">Sin sucursal</option>
                          </Select>
                        </div>
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1">Activo</p>
                          <Select value={f.assetId} onChange={set('assetId')}>
                            <option value="">— Selecciona un activo —</option>
                            {assetsInBranch.map(a => (
                              <option key={a.id} value={String(a.id)}>
                                {a.name}{a.ip ? ` · ${a.ip}` : ''}
                              </option>
                            ))}
                          </Select>
                        </div>
                        {assetsInBranch.length === 0 && (
                          <p className="text-[11px] text-text-muted">No hay activos en esta sucursal. Créalos en la sección Activos.</p>
                        )}
                        <p className="text-[11px] text-text-muted">Vincula la impresora a un activo para manejar sus conexiones desde Sesiones.</p>
                      </>
                    )}
                  </div>
                )}
              </div>
              <FormField label="Diagnóstico">
                <Input value={f.manualDiagnosis} onChange={set('manualDiagnosis')} disabled={ro} list="printer-diagnostics" placeholder="Selecciona o escribe…" />
                <datalist id="printer-diagnostics">{diagnostics.map(d => <option key={d} value={d} />)}</datalist>
              </FormField>
              <FormField label="Notas"><Textarea value={f.zNota} onChange={set('zNota')} disabled={ro} rows={4} placeholder="Pendiente por visita técnica, validación con DGI…" /></FormField>
            </Section>
        </div>
      </div>
    </div>
  )
}

// ── DGI config modal ─────────────────────────────────────────────────────────
function DgiConfigModal({ config, onClose, onSaved }: { config?: DgiConfig; onClose: () => void; onSaved: () => void }) {
  const [username, setUsername] = useState(config?.username || '')
  const [password, setPassword] = useState('')
  const [taxpayer, setTaxpayer] = useState(config?.taxpayer_id || '')

  const save = useMutation({
    mutationFn: () => printersApi.updateConfig({ username, password: password || undefined, taxpayer_id: taxpayer }),
    onSuccess: () => { toast.success('Credenciales guardadas'); onSaved() },
    onError: (e) => toast.error(errDetail(e)),
  })
  const test = useMutation({
    mutationFn: () => printersApi.testConfig(),
    onSuccess: (r) => toast.success(r.data.message),
    onError: (e) => toast.error(errDetail(e)),
  })

  return (
    <Modal open onClose={onClose} title="Configuración DGI / PlaceFT" width="max-w-md">
      <div className="space-y-4">
        <p className="text-xs font-sans text-text-secondary">
          Credenciales de la cuenta DGI usadas para consultar las impresoras fiscales. La contraseña se
          guarda <span className="text-cyan">cifrada</span> en la bóveda del panel.
        </p>
        <FormField label="Usuario / correo DGI"><Input value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario@empresa.com" /></FormField>
        <FormField label={config?.has_password ? 'Contraseña (dejar vacío = sin cambios)' : 'Contraseña'}>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </FormField>
        <FormField label="Taxpayer ID (opcional)"><Input value={taxpayer} onChange={e => setTaxpayer(e.target.value)} placeholder="UUID del contribuyente" className="font-mono text-xs" /></FormField>
        <div className="flex gap-3 pt-1">
          <Button onClick={() => save.mutate()} loading={save.isPending} className="flex-1">Guardar</Button>
          <Button variant="outline" onClick={() => test.mutate()} loading={test.isPending}>Probar conexión</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Diagnostics manager modal ────────────────────────────────────────────────
function DiagnosticsModal({ options, onClose, onSaved }: { options: string[]; onClose: () => void; onSaved: () => void }) {
  const [list, setList] = useState<string[]>(options)
  const [draft, setDraft] = useState('')
  const mut = useMutation({
    mutationFn: () => printersApi.saveDiagnostics(list),
    onSuccess: () => { toast.success('Diagnósticos guardados'); onSaved() },
    onError: (e) => toast.error(errDetail(e)),
  })
  const add = () => {
    const v = draft.trim()
    if (v && !list.includes(v)) setList(p => [...p, v].sort())
    setDraft('')
  }
  return (
    <Modal open onClose={onClose} title="Diagnósticos rápidos" width="max-w-md">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder="Nuevo diagnóstico…" />
          <Button variant="outline" onClick={add}><Plus size={14} /></Button>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {list.length === 0 && <p className="text-xs text-text-muted py-4 text-center">Sin diagnósticos aún.</p>}
          {list.map(o => (
            <div key={o} className="flex items-center justify-between bg-base border border-border rounded px-3 py-2">
              <span className="text-sm font-sans text-text-primary">{o}</span>
              <button onClick={() => setList(p => p.filter(x => x !== o))} className="text-text-muted hover:text-red-op transition-colors"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-1">
          <Button onClick={() => mut.mutate()} loading={mut.isPending} className="flex-1">Guardar lista</Button>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Setup state (DGI not configured) ─────────────────────────────────────────
function SetupState({ canManage, onConfig, detail }: { canManage: boolean; onConfig: () => void; detail: string }) {
  return (
    <div className="py-20 text-center">
      <div className="w-14 h-14 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center mx-auto mb-4 text-cyan">
        <WifiOff size={24} />
      </div>
      <p className="font-display font-semibold text-text-primary">Conexión DGI no disponible</p>
      <p className="text-sm font-sans text-text-secondary mt-1 max-w-md mx-auto">{detail}</p>
      {canManage && <div className="mt-5"><Button onClick={onConfig}><Settings2 size={14} />Configurar credenciales DGI</Button></div>}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export function PrintersPage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const canManage = can('printers.manage')

  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<'all' | PrinterEstado>('all')
  const [sucursalFilter, setSucursalFilter] = useState('all')
  const [expandedSerie, setExpandedSerie] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [showDiag, setShowDiag] = useState(false)
  const [zResults, setZResults] = useState<Record<string, { z_number?: string; z_date?: string; cached?: boolean }>>({})

  const equiposQ = useQuery({
    queryKey: ['printers-equipos'],
    queryFn: () => printersApi.equipos().then(r => r.data),
    retry: false,
  })
  const mappingsQ = useQuery({
    queryKey: ['printers-mappings'],
    queryFn: () => printersApi.mappings().then(r => r.data.mappings),
  })
  const diagnosticsQ = useQuery({
    queryKey: ['printers-diagnostics'],
    queryFn: () => printersApi.diagnostics().then(r => r.data.options),
  })
  const configQ = useQuery({
    queryKey: ['printers-config'],
    queryFn: () => printersApi.getConfig().then(r => r.data),
    enabled: canManage,
  })
  const assetsQ = useQuery({ queryKey: ['assets'], queryFn: () => assetsApi.list().then(r => r.data) })
  const branchesQ = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list().then(r => r.data) })
  const assetsById = useMemo(() => {
    const map: Record<number, Asset> = {}
    for (const a of assetsQ.data || []) map[a.id] = a
    return map
  }, [assetsQ.data])

  const mappingsBySerie = useMemo(() => {
    const map: Record<string, FiscalMapping> = {}
    for (const m of mappingsQ.data || []) map[(m.serie || '').toUpperCase()] = m
    return map
  }, [mappingsQ.data])

  const rows: Row[] = useMemo(() => {
    const eq = equiposQ.data?.equipos || []
    return eq.map(e => ({
      ...e,
      mapping: mappingsBySerie[(e.serie || '').toUpperCase()],
      zLive: zResults[(e.serie || '').toUpperCase()],
    }))
  }, [equiposQ.data, mappingsBySerie, zResults])

  const sucursales = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) {
      const v = r.mapping?.sucursal || r.sucursal
      if (v) s.add(v)
    }
    return Array.from(s).sort()
  }, [rows])

  const estadoOptions = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) { const v = r.mapping?.estadoInterno; if (v) s.add(v) }
    return Array.from(s).sort()
  }, [rows])

  const stats = useMemo(() => ({
    total: rows.length,
    actualizado: rows.filter(r => r.estado === 'Actualizado').length,
    pendiente: rows.filter(r => r.estado === 'Pendiente').length,
    critico: rows.filter(r => r.estado === 'Crítico').length,
  }), [rows])

  const filtered = useMemo(() => {
    const sl = search.toLowerCase()
    return rows.filter(r => {
      if (estadoFilter !== 'all' && r.estado !== estadoFilter) return false
      const suc = r.mapping?.sucursal || r.sucursal
      if (sucursalFilter !== 'all' && suc !== sucursalFilter) return false
      if (!sl) return true
      return [r.serie, r.modelo, r.contribuyente, suc, r.mapping?.caja, r.mapping?.sistema, r.mapping?.estadoInterno]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(sl))
    })
  }, [rows, search, estadoFilter, sucursalFilter])

  const zMut = useMutation({
    mutationFn: (r: Row) => printersApi.zreport({
      serial: r.serie, machineId: r.machineId, taxpayerId: r.taxpayerId, transmission: r.ultima_transmision, days: 30,
    }).then(res => ({ serie: r.serie, data: res.data })),
    onSuccess: ({ serie, data }) => {
      if (data.success) {
        setZResults(p => ({ ...p, [serie.toUpperCase()]: { z_number: data.z_number, z_date: data.z_date, cached: data.cached } }))
        toast.success(`Z ${data.z_number || ''} ${data.cached ? '(caché)' : ''}`.trim())
      } else {
        toast.error('No se encontró Reporte Z reciente')
      }
    },
    onError: (e) => toast.error(errDetail(e)),
  })

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['printers-equipos'] })
    qc.invalidateQueries({ queryKey: ['printers-mappings'] })
  }

  const copy = (v: string, label: string) => { navigator.clipboard.writeText(v); toast.success(`${label} copiado`) }

  const equiposError = equiposQ.isError
  const detail = equiposError ? errDetail(equiposQ.error) : ''

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Impresoras Fiscales"
        subtitle="Monitoreo de transmisión y Reporte Z (PlaceFT / DGI)"
        icon={<Printer size={16} />}
        action={
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setShowDiag(true)}><AlertTriangle size={13} />Diagnósticos</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowConfig(true)}><Settings2 size={13} />DGI</Button>
              </>
            )}
            <Button size="sm" onClick={refreshAll} loading={equiposQ.isFetching}><RefreshCw size={13} />Actualizar</Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi label="Total" value={stats.total} accent="bg-cyan/10 border-cyan/20 text-cyan" Icon={Printer} />
        <Kpi label="Actualizadas" value={stats.actualizado} accent="bg-green-op/10 border-green-op/20 text-green-op" Icon={CheckCircle2} />
        <Kpi label="Pendientes" value={stats.pendiente} accent="bg-amber-op/10 border-amber-op/20 text-amber-op" Icon={Clock} />
        <Kpi label="Críticas" value={stats.critico} accent="bg-red-op/10 border-red-op/20 text-red-op" Icon={AlertTriangle} />
      </div>

      {equiposQ.isLoading ? (
        <PageLoader />
      ) : equiposError ? (
        <SetupState canManage={canManage} onConfig={() => setShowConfig(true)} detail={detail} />
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar serie, sucursal, sistema…"
                className="w-full bg-panel border border-border rounded pl-9 pr-3 py-2 text-sm font-sans text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan/60 focus:ring-1 focus:ring-cyan/20 transition-colors" />
            </div>
            <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value as any)}
              className="bg-panel border border-border rounded px-3 py-2 text-sm font-sans text-text-primary cursor-pointer focus:outline-none focus:border-cyan/60">
              <option value="all">Todos los estados</option>
              <option value="Actualizado">Actualizado</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Crítico">Crítico</option>
            </select>
            <select value={sucursalFilter} onChange={e => setSucursalFilter(e.target.value)}
              className="bg-panel border border-border rounded px-3 py-2 text-sm font-sans text-text-primary cursor-pointer focus:outline-none focus:border-cyan/60">
              <option value="all">Todas las sucursales</option>
              {sucursales.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="bg-panel border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-elevated/40 text-left">
                    {['Serie / Modelo', 'Sucursal / Sistema', 'Última transmisión', 'Estado', 'Último Z', 'Activo', ''].map((h, i) => (
                      <th key={i} className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-text-muted font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const suc = r.mapping?.sucursal || r.sucursal || '—'
                    const zNum = r.zLive?.z_number ?? (r.ultimaZ !== 'N/A' ? r.ultimaZ : undefined)
                    const zDate = r.zLive?.z_date ?? (r.ultimoReporteZ !== 'N/A' ? r.ultimoReporteZ : undefined)
                    const isOpen = expandedSerie === r.serie
                    return (
                      <Fragment key={r.serie || i}>
                      <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.01, 0.3) }}
                        onClick={() => setExpandedSerie(isOpen ? null : r.serie)}
                        className={`border-b border-border/60 last:border-0 transition-colors cursor-pointer ${isOpen ? 'bg-elevated/40' : 'hover:bg-elevated/30'}`}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-text-primary">{r.serie}</span>
                            <button onClick={(e) => { e.stopPropagation(); copy(r.serie, 'Serie') }} className="text-text-muted hover:text-cyan transition-colors"><Copy size={10} /></button>
                          </div>
                          <p className="text-[11px] text-text-muted">{r.modelo || '—'}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-text-primary text-xs">{suc}</p>
                          <p className="text-[11px] text-text-muted">
                            {r.mapping?.sistema || '—'}{r.mapping?.caja ? ` · Caja ${r.mapping.caja}` : ''}
                          </p>
                          {r.mapping?.estadoInterno && <Badge variant="muted" className="mt-1">{r.mapping.estadoInterno}</Badge>}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-text-secondary text-xs">{r.ultima_transmision ? r.ultima_transmision.slice(0, 19).replace('T', ' ') : '—'}</p>
                          <p className="text-[11px] text-text-muted">{r.dias_sin_actualizar >= 999 ? 'sin datos' : `hace ${r.dias_sin_actualizar} día(s)`}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={ESTADO_BADGE[r.estado]} dot>{r.estado}</Badge>
                          {r.mapping?.alertaNota && (
                            <p className="text-[11px] text-amber-op mt-1 flex items-center gap-1"><AlertTriangle size={9} />{r.mapping.alertaNota.slice(0, 28)}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {zNum ? (
                            <>
                              <span className={`font-mono text-xs ${zNum === 'Invalid' ? 'text-red-op' : 'text-text-primary'}`}>#{zNum}</span>
                              <p className="text-[11px] text-text-muted">{zDate || ''}{r.zLive?.cached ? ' (caché)' : ''}</p>
                            </>
                          ) : <span className="text-[11px] text-text-muted">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.mapping?.assetId && assetsById[r.mapping.assetId] ? (
                            <span className="font-sans text-xs text-text-secondary truncate inline-flex items-center gap-1.5">
                              <MonitorSmartphone size={11} className="text-cyan flex-shrink-0" />
                              {assetsById[r.mapping.assetId].name}
                            </span>
                          ) : <span className="text-[11px] text-text-muted">Sin vincular</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={(e) => { e.stopPropagation(); zMut.mutate(r) }} disabled={zMut.isPending}
                              title="Consultar Reporte Z" className="p-1.5 rounded text-text-muted hover:text-cyan hover:bg-cyan/10 transition-colors disabled:opacity-40">
                              <FileBarChart2 size={14} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setExpandedSerie(isOpen ? null : r.serie) }} title={isOpen ? 'Cerrar' : 'Ver detalle'}
                              className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-elevated transition-colors">
                              <ChevronRight size={15} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <DetailPanel
                              row={r}
                              assets={assetsQ.data || []}
                              branches={branchesQ.data || []}
                              sucursales={sucursales}
                              estadoOptions={estadoOptions}
                              diagnostics={diagnosticsQ.data || []}
                              canManage={canManage}
                              onClose={() => setExpandedSerie(null)}
                              onSaved={() => qc.invalidateQueries({ queryKey: ['printers-mappings'] })}
                              onZResult={(serie, z) => setZResults(p => ({ ...p, [serie.toUpperCase()]: z }))}
                            />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-text-muted">Sin impresoras que coincidan con el filtro.</div>
            )}
          </div>
          <p className="mt-3 font-mono text-[10px] text-text-muted">
            {filtered.length} de {rows.length} equipos · datos en vivo desde la DGI
          </p>
        </>
      )}

      {showConfig && (
        <DgiConfigModal config={configQ.data} onClose={() => setShowConfig(false)}
          onSaved={() => { setShowConfig(false); qc.invalidateQueries({ queryKey: ['printers-config'] }); refreshAll() }} />
      )}
      {showDiag && (
        <DiagnosticsModal options={diagnosticsQ.data || []} onClose={() => setShowDiag(false)}
          onSaved={() => { setShowDiag(false); qc.invalidateQueries({ queryKey: ['printers-diagnostics'] }) }} />
      )}
    </div>
  )
}

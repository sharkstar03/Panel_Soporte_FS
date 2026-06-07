import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Monitor, Server, Box, Plus, Pencil, Trash2, Shield, ArrowLeft, Building2, Search, Hash } from 'lucide-react'
import toast from 'react-hot-toast'
import { assetsApi, branchesApi } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea, FormField } from '../components/ui/Input'
import { PageLoader } from '../components/ui/Spinner'
import { TOOL_META } from '../components/ToolLogos'
import type { Asset, AssetCreateIn, AssetType, Branch } from '../api/types'
import { useAuth } from '../context/AuthContext'

const typeIcon = { pc: Monitor, servidor: Server, otro: Box }
const typeLabel = { pc: 'PC', servidor: 'Servidor', otro: 'Otro' }


function AssetForm({ initial, onSave, onCancel, loading, branches }: {
  initial?: Partial<AssetCreateIn>
  onSave: (d: AssetCreateIn) => void
  onCancel: () => void
  loading: boolean
  branches: Branch[]
}) {
  const [f, setF] = useState<AssetCreateIn>({
    name: '', type: 'pc', owner: '', location: '', notes: '', branch_id: undefined,
    hostname: '', ip: '', anydesk_id: '', anydesk_password: undefined,
    rustdesk_id: '', rustdesk_password: undefined,
    teamviewer_id: '', teamviewer_password: undefined,
    vnc_host: '', vnc_port: 5900,
    rdp_host: '', rdp_port: 3389, rdp_username: '',
    sensitive: false,
    ...initial,
  })
  const [editingRemote, setEditingRemote] = useState<string>('')

  const set = (k: keyof AssetCreateIn) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }))

  const submit = () => {
    onSave({
      ...f,
      anydesk_password: f.anydesk_password ? f.anydesk_password : undefined,
      rustdesk_password: f.rustdesk_password ? f.rustdesk_password : undefined,
      teamviewer_password: f.teamviewer_password ? f.teamviewer_password : undefined,
    })
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre *">
          <Input value={f.name} onChange={set('name')} placeholder="PC-CONTABILIDAD" required />
        </FormField>
        <FormField label="Tipo">
          <Select value={f.type} onChange={set('type')}>
            <option value="pc">PC</option>
            <option value="servidor">Servidor</option>
            <option value="otro">Otro</option>
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {!f.branch_id ? (
          <FormField label="Propietario">
            <Input value={f.owner ?? ''} onChange={set('owner')} placeholder="Nombre del usuario" />
          </FormField>
        ) : (
          <FormField label="Ubicación interna">
            <Input value={f.location ?? ''} onChange={set('location')} placeholder="Caja 3 / Manager PC" />
          </FormField>
        )}
        <FormField label="Sucursal">
          <Select value={f.branch_id ?? ''} onChange={e => setF(p => ({ ...p, branch_id: e.target.value ? Number(e.target.value) : undefined, owner: e.target.value ? undefined : p.owner }))}>
            <option value="">— Sin sucursal —</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ''}</option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Hostname">
          <Input value={f.hostname ?? ''} onChange={set('hostname')} placeholder="PC-01" />
        </FormField>
        <FormField label="IP">
          <Input value={f.ip ?? ''} onChange={set('ip')} placeholder="192.168.1.10" />
        </FormField>
      </div>
      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-[11px] font-sans font-medium text-text-muted uppercase tracking-wide">Acceso Remoto</p>

        <FormField label="Herramienta a configurar">
          <Select value={editingRemote} onChange={e => setEditingRemote(e.target.value)}>
            <option value="">— Seleccionar —</option>
            <option value="anydesk">AnyDesk</option>
            <option value="rustdesk">RustDesk</option>
            <option value="teamviewer">TeamViewer</option>
            <option value="vnc">UltraVNC</option>
            <option value="rdp">Remote Desktop (RDP)</option>
          </Select>
        </FormField>

        {editingRemote === 'anydesk' && (
          <div className="grid grid-cols-2 gap-4 animate-fade-in">
            <FormField label="AnyDesk ID">
              <Input value={f.anydesk_id ?? ''} onChange={set('anydesk_id')} placeholder="123456789" />
            </FormField>
            <FormField label="AnyDesk Password">
              <Input type="password" value={f.anydesk_password ?? ''} onChange={set('anydesk_password')} placeholder="••••••" />
            </FormField>
          </div>
        )}

        {editingRemote === 'rustdesk' && (
          <div className="grid grid-cols-2 gap-4 animate-fade-in">
            <FormField label="RustDesk ID">
              <Input value={f.rustdesk_id ?? ''} onChange={set('rustdesk_id')} placeholder="RUST-001" />
            </FormField>
            <FormField label="RustDesk Password">
              <Input type="password" value={f.rustdesk_password ?? ''} onChange={set('rustdesk_password')} placeholder="••••••" />
            </FormField>
          </div>
        )}

        {editingRemote === 'teamviewer' && (
          <div className="grid grid-cols-2 gap-4 animate-fade-in">
            <FormField label="TeamViewer ID">
              <Input value={f.teamviewer_id ?? ''} onChange={set('teamviewer_id')} placeholder="TV-001" />
            </FormField>
            <FormField label="TeamViewer Password">
              <Input type="password" value={f.teamviewer_password ?? ''} onChange={set('teamviewer_password')} placeholder="••••••" />
            </FormField>
          </div>
        )}

        {editingRemote === 'vnc' && (
          <div className="grid grid-cols-2 gap-4 animate-fade-in">
            <FormField label="VNC Host">
              <Input value={f.vnc_host ?? ''} onChange={set('vnc_host')} placeholder="192.168.1.10" />
            </FormField>
            <FormField label="VNC Puerto">
              <Input type="number" value={f.vnc_port} onChange={set('vnc_port')} placeholder="5900" />
            </FormField>
          </div>
        )}

        {editingRemote === 'rdp' && (
          <div className="grid grid-cols-3 gap-4 animate-fade-in">
            <FormField label="RDP Host">
              <Input value={f.rdp_host ?? ''} onChange={set('rdp_host')} placeholder="192.168.1.10" />
            </FormField>
            <FormField label="RDP Puerto">
              <Input type="number" value={f.rdp_port} onChange={set('rdp_port')} placeholder="3389" />
            </FormField>
            <FormField label="Usuario RDP">
              <Input value={f.rdp_username ?? ''} onChange={set('rdp_username')} placeholder="Administrador" />
            </FormField>
          </div>
        )}
      </div>
      <FormField label="Notas">
        <Textarea value={f.notes ?? ''} onChange={set('notes')} rows={2} placeholder="Información adicional..." />
      </FormField>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={f.sensitive} onChange={e => setF(p => ({ ...p, sensitive: e.target.checked }))}
          className="w-4 h-4 rounded border-border bg-elevated text-cyan focus:ring-cyan/20" />
        <span className="text-sm font-sans text-text-secondary">Activo sensible (requiere aprobación)</span>
        <Shield size={13} className="text-amber-op" />
      </label>
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading} className="flex-1">Guardar activo</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}


export function AssetsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin' || user?.role === 'supervisor'

  const [view, setView] = useState<'branches' | 'branch_assets'>('branches')
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [search, setSearch] = useState('')

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchesApi.list().then(r => r.data),
  })

  const { data: allAssets = [], isLoading: allAssetsLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => assetsApi.list().then(r => r.data),
    enabled: view === 'branches',
  })

  const { data: branchAssets = [], isLoading: branchAssetsLoading } = useQuery({
    queryKey: ['assets', { branch_id: selectedBranch?.id }],
    queryFn: () => assetsApi.list({ branch_id: selectedBranch!.id }).then(r => r.data),
    enabled: view === 'branch_assets' && !!selectedBranch,
  })

  const create = useMutation({
    mutationFn: (d: AssetCreateIn) => assetsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      setShowCreate(false)
    },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AssetCreateIn> }) => assetsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      setEditing(null)
    },
  })

  const del = useMutation({
    mutationFn: (id: number) => assetsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })

  const branchDelete = useMutation({
    mutationFn: (id: number) => branchesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  })

  const branchCount = (branchId: number | null) =>
    allAssets.filter(a => a.branch_id === branchId).length

  const openBranch = (branch: Branch) => {
    setSelectedBranch(branch)
    setView('branch_assets')
    setSearch('')
  }

  const goBack = () => {
    setView('branches')
    setSelectedBranch(null)
    setSearch('')
  }

  const displayedAssets = view === 'branch_assets' ? branchAssets : allAssets
  const filteredAssets = displayedAssets.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.owner ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.ip ?? '').includes(search)
  )

  const branchMap: Record<number, string> = Object.fromEntries(branches.map(b => [b.id, b.name]))

  if (branchesLoading) return <PageLoader />

  // ========== BRANCHES VIEW ==========
  if (view === 'branches') {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Activos"
          subtitle={`${allAssets.length} equipos en ${branches.length} sucursales`}
          icon={<Monitor size={16} />}
          action={isAdmin ? <Button onClick={() => setShowCreate(true)} size="sm"><Plus size={14} />Nuevo activo</Button> : undefined}
        />

        <div className="mt-5 bg-panel border border-border rounded-lg overflow-hidden">
          <div className="border-b border-border bg-elevated/30 px-4 py-3">
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
              Lista de sucursales
            </p>
          </div>
          <div className="divide-y divide-border/50">
            <AnimatePresence>
              {branches.map((branch, i) => {
                const count = branchCount(branch.id)
                return (
                  <motion.button
                    key={branch.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => openBranch(branch)}
                    className="w-full text-left px-4 py-3 hover:bg-elevated/40 transition-colors flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan flex-shrink-0">
                      <Building2 size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-semibold text-sm text-text-primary tracking-wide truncate">
                        {branch.code ? `${branch.code} - ${branch.name}` : branch.name}
                      </p>
                      <p className="text-[11px] font-sans text-text-muted truncate">
                        {count} activo{count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Badge variant="muted" className="text-[10px] font-mono">{count}</Badge>
                  </motion.button>
                )
              })}

              {/* Sin sucursal */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: branches.length * 0.02 }}
                onClick={() => {
                  setSelectedBranch({ id: -1, name: 'Sin sucursal', code: null, sort_order: 0, created_at: '' } as Branch)
                  setView('branch_assets')
                  setSearch('')
                }}
                className="w-full text-left px-4 py-3 hover:bg-elevated/40 transition-colors flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center text-amber flex-shrink-0">
                  <Box size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm text-text-primary tracking-wide truncate">
                    Sin sucursal asignada
                  </p>
                  <p className="text-[11px] font-sans text-text-muted truncate">
                    {branchCount(null)} activo{branchCount(null) !== 1 ? 's' : ''}
                  </p>
                </div>
                <Badge variant="muted" className="text-[10px] font-mono">{branchCount(null)}</Badge>
              </motion.button>
            </AnimatePresence>
          </div>
        </div>

        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Activo" width="max-w-xl">
          <AssetForm
            branches={branches}
            onSave={(d) => create.mutate(d)}
            onCancel={() => setShowCreate(false)}
            loading={create.isPending}
          />
        </Modal>

      </div>
    )
  }

  // ========== BRANCH ASSETS VIEW ==========
  const currentBranch = selectedBranch!
  const assetsToShow = currentBranch.id === -1
    ? allAssets.filter(a => a.branch_id === null)
    : filteredAssets

  return (
    <div className="animate-fade-in">
      <div className="mb-2">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft size={14} /> Volver
        </Button>
      </div>
      <PageHeader
        title={currentBranch.name}
        subtitle={`${assetsToShow.length} activos`}
        icon={<Building2 size={16} />}
        action={isAdmin ? <Button onClick={() => setShowCreate(true)} size="sm"><Plus size={14} />Nuevo activo</Button> : undefined}
      />

      {/* Search */}
      <div className="mt-5 mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, propietario o IP..."
          className="w-full max-w-sm bg-panel border border-border rounded px-3 py-2 text-sm text-text-primary font-sans placeholder:text-text-muted focus:outline-none focus:border-cyan/60 focus:ring-1 focus:ring-cyan/20 transition-colors"
        />
      </div>

      {/* Assets Table */}
      {branchAssetsLoading ? <PageLoader /> : assetsToShow.length === 0 ? (
        <div className="text-center py-16">
          <Monitor size={36} className="text-text-muted mx-auto mb-3" />
          <p className="font-sans text-sm text-text-secondary">No se encontraron activos en esta sucursal.</p>
        </div>
      ) : (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Activo', 'IP', 'Conexiones', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-mono text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {assetsToShow.map((asset, i) => {
                  const Icon = typeIcon[asset.type] ?? Box
                  const hasRemote = asset.anydesk_id || asset.rustdesk_id || asset.teamviewer_id || asset.vnc_host || asset.rdp_host
                  return (
                    <motion.tr
                      key={asset.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-elevated/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan flex-shrink-0">
                            <Icon size={15} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-display font-semibold text-sm text-text-primary tracking-wide">{asset.name}</span>
                              {asset.sensitive && <Shield size={11} className="text-amber-op" />}
                            </div>
                            <p className="text-[10px] font-sans text-text-muted truncate max-w-[240px]">
                              {asset.branch_id ? (
                                <>
                                  <span className="text-cyan/70">{(() => {
                                    const b = branches.find(x => x.id === asset.branch_id)
                                    return b?.code ? `${b.code} - ${b.name}` : (b?.name ?? 'Sucursal')
                                  })()}</span>
                                  {asset.location && <><span className="mx-1">·</span><span>{asset.location}</span></>}
                                </>
                              ) : (
                                <>
                                  {asset.owner && <span>{asset.owner}</span>}
                                  {asset.owner && asset.location && <span className="mx-1">·</span>}
                                  {asset.location && <span>{asset.location}</span>}
                                  {!asset.owner && !asset.location && <span className="font-mono uppercase tracking-wide">{typeLabel[asset.type]}</span>}
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-cyan/80 whitespace-nowrap">{asset.ip ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(['anydesk', 'rustdesk', 'teamviewer', 'ultravnc', 'rdp'] as const)
                            .filter(t => {
                              if (t === 'anydesk') return asset.anydesk_id
                              if (t === 'rustdesk') return asset.rustdesk_id
                              if (t === 'teamviewer') return asset.teamviewer_id
                              if (t === 'ultravnc') return asset.vnc_host
                              if (t === 'rdp') return asset.rdp_host
                              return false
                            })
                            .map(t => {
                              const meta = TOOL_META[t]
                              return (
                                <div key={t} className={`flex items-center justify-center rounded p-1 border ${meta.borderColor} ${meta.bgColor}`} title={meta.label}>
                                  <meta.Logo size={16} />
                                </div>
                              )
                            })}
                          {!hasRemote && <span className="text-[10px] font-mono text-text-muted">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin && (
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditing(asset)}>
                              <Pencil size={12} />
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => del.mutate(asset.id)} loading={del.isPending}>
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Activo" width="max-w-xl">
        <AssetForm
          branches={branches}
          initial={{ branch_id: currentBranch.id >= 0 ? currentBranch.id : undefined }}
          onSave={(d) => create.mutate(d)}
          onCancel={() => setShowCreate(false)}
          loading={create.isPending}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar Activo" width="max-w-xl">
        {editing && (
          <AssetForm
            branches={branches}
            initial={{
              ...editing,
              owner: editing.owner ?? undefined,
              location: editing.location ?? undefined,
              notes: editing.notes ?? undefined,
              branch_id: editing.branch_id ?? undefined,
              hostname: editing.hostname ?? undefined,
              ip: editing.ip ?? undefined,
              anydesk_id: editing.anydesk_id ?? undefined,
              anydesk_password: editing.anydesk_password ?? undefined,
              rustdesk_id: editing.rustdesk_id ?? undefined,
              rustdesk_password: editing.rustdesk_password ?? undefined,
              teamviewer_id: editing.teamviewer_id ?? undefined,
              teamviewer_password: editing.teamviewer_password ?? undefined,
              vnc_host: editing.vnc_host ?? undefined,
              rdp_host: editing.rdp_host ?? undefined,
              rdp_port: editing.rdp_port,
              rdp_username: editing.rdp_username ?? undefined,
            }}
            onSave={(d) => update.mutate({ id: editing.id, data: d })}
            onCancel={() => setEditing(null)}
            loading={update.isPending}
          />
        )}
      </Modal>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert, Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { rbacApi } from '../api/client'
import type { Permission, Role } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, FormField } from '../components/ui/Input'
import { PageLoader } from '../components/ui/Spinner'

function groupPermissions(perms: Permission[]) {
  const map: Record<string, Permission[]> = {}
  for (const p of perms) {
    const k = p.category || 'general'
    map[k] = map[k] || []
    map[k].push(p)
  }
  for (const k of Object.keys(map)) map[k] = map[k].sort((a, b) => a.code.localeCompare(b.code))
  return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
}

function RoleForm({ allPermissions, initial, onSave, loading }: {
  allPermissions: Permission[]
  initial?: Partial<Role>
  onSave: (data: { name?: string; description?: string; permissions: string[] }) => void
  loading: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial?.permissions ?? []))

  const groups = useMemo(() => groupPermissions(allPermissions), [allPermissions])

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ name: name || undefined, description: description || undefined, permissions: Array.from(selected) })
      }}
      className="space-y-4"
    >
      {initial?.id == null && (
        <FormField label="Nombre *">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="soporte_n2" required />
        </FormField>
      )}
      <FormField label="Descripción">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Rol para..." />
      </FormField>

      <div className="space-y-3">
        {groups.map(([category, perms]) => (
          <div key={category} className="bg-base border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono text-text-secondary uppercase tracking-widest">{category}</p>
              <Badge variant="muted" className="text-[10px]">{perms.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {perms.map((p) => {
                const checked = selected.has(p.code)
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => toggle(p.code)}
                    className={`text-left px-3 py-2 rounded border transition-colors ${
                      checked ? 'bg-cyan/10 border-cyan/30 text-text-primary' : 'bg-panel border-border text-text-secondary hover:border-border-bright'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[11px]">{p.code}</span>
                      <span className={`text-[10px] font-mono ${checked ? 'text-cyan' : 'text-text-muted'}`}>{checked ? 'ON' : 'OFF'}</span>
                    </div>
                    {!!p.description && <p className="text-[11px] mt-1 text-text-muted">{p.description}</p>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading} className="flex-1">Guardar</Button>
      </div>
    </form>
  )
}

export function RBACPage({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)

  const permsQ = useQuery({ queryKey: ['rbac-permissions'], queryFn: () => rbacApi.permissions().then(r => r.data) })
  const rolesQ = useQuery({ queryKey: ['rbac-roles'], queryFn: () => rbacApi.roles().then(r => r.data) })

  const create = useMutation({
    mutationFn: (data: { name?: string; description?: string; permissions: string[] }) =>
      rbacApi.createRole({ name: String(data.name || ''), description: data.description, permissions: data.permissions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac-roles'] })
      setShowCreate(false)
      toast.success('Rol creado')
    },
    onError: () => toast.error('Error al crear rol'),
  })

  const update = useMutation({
    mutationFn: (data: { id: number; description?: string; permissions: string[] }) =>
      rbacApi.updateRole(data.id, { description: data.description, permissions: data.permissions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac-roles'] })
      setEditing(null)
      toast.success('Rol actualizado')
    },
    onError: () => toast.error('Error al actualizar rol'),
  })

  const del = useMutation({
    mutationFn: (id: number) => rbacApi.deleteRole(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac-roles'] })
      toast.success('Rol eliminado')
    },
    onError: () => toast.error('Error al eliminar rol'),
  })

  if (permsQ.isLoading || rolesQ.isLoading) return <PageLoader />
  const permissions = permsQ.data as Permission[] || []
  const roles = rolesQ.data as Role[] || []

  return (
    <div className={embedded ? 'space-y-6' : 'animate-fade-in space-y-6'}>
      {!embedded && (
        <PageHeader
          title="Roles y permisos"
          subtitle="Controla accesos a menús y acciones"
          icon={<ShieldAlert size={16} />}
          action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} />Nuevo rol</Button>}
        />
      )}
      {embedded && (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display font-semibold text-text-primary">Roles y permisos</p>
            <p className="text-xs text-text-muted">Controla accesos a menús y acciones</p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} />Nuevo rol</Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {roles.map((r) => (
          <div key={r.id} className="bg-panel border border-border rounded-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-display font-semibold text-text-primary truncate">{r.name}</p>
                <p className="text-xs text-text-muted mt-1">{r.description || '—'}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.permissions.slice(0, 8).map((p) => (
                    <Badge key={p} variant="muted" className="text-[10px] font-mono">{p}</Badge>
                  ))}
                  {r.permissions.length > 8 && <Badge variant="muted" className="text-[10px]">+{r.permissions.length - 8}</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil size={14} /></Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="hover:text-red-op"
                  onClick={() => {
                    if (confirm(`¿Eliminar rol "${r.name}"?`)) del.mutate(r.id)
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo rol" width="max-w-3xl">
        <RoleForm
          allPermissions={permissions}
          onSave={(d) => create.mutate({ name: d.name, description: d.description, permissions: d.permissions })}
          loading={create.isPending}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Editar rol — ${editing?.name ?? ''}`} width="max-w-3xl">
        {!!editing && (
          <RoleForm
            allPermissions={permissions}
            initial={editing}
            onSave={(d) => update.mutate({ id: editing.id, description: d.description, permissions: d.permissions })}
            loading={update.isPending}
          />
        )}
      </Modal>
    </div>
  )
}

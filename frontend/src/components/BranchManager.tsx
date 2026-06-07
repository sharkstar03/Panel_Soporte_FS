import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Pencil, Trash2, ArrowUp, ArrowDown, Hash } from 'lucide-react'
import { branchesApi } from '../api/client'
import { Button } from './ui/Button'
import { Input, FormField } from './ui/Input'
import { Modal } from './ui/Modal'
import type { Branch, BranchCreateIn } from '../api/types'
import { useAuth } from '../context/AuthContext'

interface Props {
  open?: boolean
  onClose?: () => void
  inline?: boolean
}

export function BranchManager({ open, onClose, inline }: Props) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin' || user?.role === 'supervisor'

  const [editing, setEditing] = useState<Branch | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [orderEdits, setOrderEdits] = useState<Record<number, number>>({})
  const [savingOrder, setSavingOrder] = useState<Record<number, boolean>>({})

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchesApi.list().then(r => r.data),
    enabled: inline || open,
  })

  const create = useMutation({
    mutationFn: (data: BranchCreateIn) => branchesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      resetForm()
    },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: BranchCreateIn }) => branchesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      resetForm()
    },
  })

  const del = useMutation({
    mutationFn: (id: number) => branchesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  })

  const resetForm = () => {
    setEditing(null)
    setName('')
    setCode('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const data: BranchCreateIn = { name: name.trim(), code: code.trim() || undefined }
    if (editing) {
      update.mutate({ id: editing.id, data })
    } else {
      create.mutate(data)
    }
  }

  const startEdit = (branch: Branch) => {
    setEditing(branch)
    setName(branch.name)
    setCode(branch.code ?? '')
  }

  const sortedBranches = [...branches].sort((a, b) => {
    const ao = a.sort_order ?? 0
    const bo = b.sort_order ?? 0
    if (ao !== bo) return ao - bo
    return a.name.localeCompare(b.name)
  })

  const persistOrder = async (branch: Branch, newOrder: number) => {
    if (!isAdmin) return
    setSavingOrder(prev => ({ ...prev, [branch.id]: true }))
    try {
      await branchesApi.update(branch.id, {
        name: branch.name,
        code: branch.code ?? undefined,
        sort_order: newOrder,
      })
      await qc.invalidateQueries({ queryKey: ['branches'] })
    } finally {
      setSavingOrder(prev => ({ ...prev, [branch.id]: false }))
    }
  }

  const moveBranch = async (branchId: number, dir: -1 | 1) => {
    if (!isAdmin) return
    const list = sortedBranches
    const idx = list.findIndex(b => b.id === branchId)
    const other = list[idx + dir]
    const current = list[idx]
    if (!current || !other) return

    // Swap de sort_order para mover visualmente sin recalcular toda la lista.
    setSavingOrder(prev => ({ ...prev, [current.id]: true, [other.id]: true }))
    try {
      await Promise.all([
        branchesApi.update(current.id, {
          name: current.name,
          code: current.code ?? undefined,
          sort_order: other.sort_order ?? 0,
        }),
        branchesApi.update(other.id, {
          name: other.name,
          code: other.code ?? undefined,
          sort_order: current.sort_order ?? 0,
        }),
      ])
      await qc.invalidateQueries({ queryKey: ['branches'] })
    } finally {
      setSavingOrder(prev => ({ ...prev, [current.id]: false, [other.id]: false }))
    }
  }

  const content = (
    <div className="space-y-5">
      {/* Form */}
      {isAdmin && (
        <form onSubmit={handleSubmit} className="bg-elevated/40 border border-border rounded-lg p-4 space-y-3">
          <p className="text-[11px] font-sans font-medium text-text-muted uppercase tracking-wide">
            {editing ? 'Editar sucursal' : 'Nueva sucursal'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Nombre *">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Sucursal Centro" required />
            </FormField>
            <FormField label="Código">
              <Input value={code} onChange={e => setCode(e.target.value)} placeholder="SC-001" />
            </FormField>
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={create.isPending || update.isPending} size="sm">
              {editing ? 'Actualizar' : 'Crear sucursal'}
            </Button>
            {editing && (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      )}

      {/* List */}
      <div className="space-y-2">
        <p className="text-[11px] font-sans font-medium text-text-muted uppercase tracking-wide">
          {branches.length} sucursal{branches.length !== 1 ? 'es' : ''}
        </p>
        {isLoading ? (
          <p className="text-sm text-text-muted font-sans">Cargando...</p>
        ) : branches.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <Building2 size={28} className="text-text-muted mx-auto mb-2" />
            <p className="text-sm text-text-secondary font-sans">No hay sucursales creadas.</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <AnimatePresence>
              {sortedBranches.map((branch, i) => (
                <motion.div
                  key={branch.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0 hover:bg-elevated/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan flex-shrink-0">
                      <Building2 size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-sm text-text-primary tracking-wide truncate">
                        {branch.code ? `${branch.code} - ${branch.name}` : branch.name}
                      </p>
                    </div>
                  </div>

                  {/* Orden / acciones */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Posición */}
                      <div className="hidden sm:flex items-center gap-1 mr-1">
                        <Hash size={12} className="text-text-muted" />
                        <Input
                          type="number"
                          min={0}
                          value={orderEdits[branch.id] ?? (branch.sort_order ?? 0)}
                          onChange={(e) => setOrderEdits(prev => ({ ...prev, [branch.id]: Number(e.target.value) }))}
                          onBlur={() => {
                            const v = orderEdits[branch.id]
                            if (v === undefined) return
                            if (v === (branch.sort_order ?? 0)) return
                            persistOrder(branch, v)
                          }}
                          className="w-16 px-2 py-1 text-xs font-mono"
                          disabled={!!savingOrder[branch.id]}
                          title="Posición (menor = más arriba)"
                        />
                      </div>

                      {/* Mover */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveBranch(branch.id, -1)}
                        disabled={i === 0 || !!savingOrder[branch.id]}
                        title="Subir"
                      >
                        <ArrowUp size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveBranch(branch.id, 1)}
                        disabled={i === sortedBranches.length - 1 || !!savingOrder[branch.id]}
                        title="Bajar"
                      >
                        <ArrowDown size={12} />
                      </Button>

                      <Button variant="ghost" size="sm" onClick={() => startEdit(branch)}>
                        <Pencil size={12} />
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => del.mutate(branch.id)} loading={del.isPending}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )

  if (inline) return content

  return (
    <Modal open={open || false} onClose={onClose || (() => {})} title="Gestionar Sucursales" width="max-w-lg">
      {content}
    </Modal>
  )
}

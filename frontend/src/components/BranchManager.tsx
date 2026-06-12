import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Pencil, Trash2, GripVertical } from 'lucide-react'
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
  const [order, setOrder] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)
  const dragId = useRef<number | null>(null)

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

  // Mantiene el orden local sincronizado con el servidor (salvo mientras se guarda).
  useEffect(() => {
    if (busy) return
    setOrder(sortedBranches.map(b => b.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, busy])

  const byId = new Map(branches.map(b => [b.id, b]))
  const orderedBranches: Branch[] = (order.length ? order : sortedBranches.map(b => b.id))
    .map(id => byId.get(id))
    .filter((b): b is Branch => !!b)

  // Persiste un nuevo orden asignando sort_order = posición (0..n).
  const persistOrder = async (newIds: number[]) => {
    if (!isAdmin) return
    setBusy(true)
    try {
      const updates = newIds
        .map((id, idx) => {
          const b = byId.get(id)
          if (!b || (b.sort_order ?? 0) === idx) return null
          return branchesApi.update(id, { name: b.name, code: b.code ?? undefined, sort_order: idx })
        })
        .filter((p): p is ReturnType<typeof branchesApi.update> => p !== null)
      if (updates.length) await Promise.all(updates)
      await qc.invalidateQueries({ queryKey: ['branches'] })
    } finally {
      setBusy(false)
    }
  }

  const handleDrop = (targetId: number) => {
    const from = dragId.current
    setDraggingId(null)
    setOverId(null)
    dragId.current = null
    if (from == null || from === targetId) return
    const fromIdx = order.indexOf(from)
    const toIdx = order.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...order]
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, from)
    setOrder(next)
    persistOrder(next)
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
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-sans font-medium text-text-muted uppercase tracking-wide">
            {branches.length} sucursal{branches.length !== 1 ? 'es' : ''}
          </p>
          {isAdmin && branches.length > 1 && (
            <p className="text-[11px] font-sans text-text-muted">Arrastra para ordenar</p>
          )}
        </div>
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
              {orderedBranches.map((branch, i) => (
                <motion.div
                  key={branch.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: draggingId === branch.id ? 0.4 : 1 }}
                  exit={{ opacity: 0 }}
                  draggable={isAdmin}
                  onDragStart={() => { dragId.current = branch.id; setDraggingId(branch.id) }}
                  onDragOver={(e) => { e.preventDefault(); if (overId !== branch.id) setOverId(branch.id) }}
                  onDrop={() => handleDrop(branch.id)}
                  onDragEnd={() => { setDraggingId(null); setOverId(null); dragId.current = null }}
                  className={`flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0 transition-colors ${
                    overId === branch.id && draggingId !== branch.id ? 'bg-cyan/10' : 'hover:bg-elevated/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isAdmin && (
                      <span className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-secondary flex-shrink-0" title="Arrastrar para reordenar">
                        <GripVertical size={15} />
                      </span>
                    )}
                    <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan flex-shrink-0">
                      <Building2 size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-sm text-text-primary tracking-wide truncate">
                        {branch.code ? `${branch.code} - ${branch.name}` : branch.name}
                      </p>
                    </div>
                  </div>

                  {/* Acciones */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
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

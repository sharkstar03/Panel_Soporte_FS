import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Pencil, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { documentTemplatesApi } from '../api/client'
import type { DocumentTemplate, DocumentType } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea, FormField } from '../components/ui/Input'
import { PageLoader } from '../components/ui/Spinner'

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'entrega_equipo', label: 'Entrega de Equipo' },
  { value: 'control_equipo', label: 'Control / Inspección' },
  { value: 'pago_proveedor', label: 'Pago a Proveedor' },
  { value: 'checklist_diario', label: 'Checklist Diario' },
]

function defaultSample(type: DocumentType) {
  if (type === 'entrega_equipo') {
    return JSON.stringify({ equipo: 'Laptop Dell', numero_serie: 'ABC123', entregado_a: 'María', sucursal: 'Sucursal 1', fecha: '2026-06-06', tecnico: 'Soporte' }, null, 2)
  }
  if (type === 'control_equipo') {
    return JSON.stringify({ equipo: 'PC Caja', numero_serie: 'SN-0099', fecha_inspeccion: '2026-06-06', tecnico: 'Soporte', estado_general: 'OK', observaciones: 'Sin novedades' }, null, 2)
  }
  if (type === 'pago_proveedor') {
    return JSON.stringify({ proveedor: 'Proveedor X', ruc: '123-456', servicio: 'Mantenimiento', monto: '150.00', moneda: 'USD', fecha_pago: '2026-06-10', notas: 'Urgente' }, null, 2)
  }
  return JSON.stringify({ tecnico: 'Soporte', fecha: '2026-06-06', observaciones: 'Checklist' }, null, 2)
}

function TemplateForm({ initial, onSave, saving }: {
  initial?: Partial<DocumentTemplate>
  onSave: (d: { name: string; doc_type: DocumentType; html: string; is_default: boolean }) => void
  saving: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [docType, setDocType] = useState<DocumentType>((initial?.doc_type as DocumentType) ?? 'entrega_equipo')
  const [html, setHtml] = useState(initial?.html ?? '<h1>{{document.title}}</h1>\n<p>Técnico: {{creator.username}}</p>\n<p>Equipo: {{equipo}}</p>')
  const [isDefault, setIsDefault] = useState<boolean>(initial?.is_default ?? false)

  useEffect(() => {
    if (!initial) return
    setName(initial.name ?? '')
    setDocType((initial.doc_type as DocumentType) ?? 'entrega_equipo')
    setHtml(initial.html ?? '')
    setIsDefault(!!initial.is_default)
  }, [initial?.id])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ name, doc_type: docType, html, is_default: isDefault })
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Nombre *">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plantilla Entrega v1" required />
        </FormField>
        <FormField label="Tipo">
          <Select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </FormField>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="w-4 h-4 rounded border-border bg-elevated text-cyan focus:ring-cyan/20"
        />
        <span className="text-sm font-sans text-text-secondary">Usar como plantilla por defecto para este tipo</span>
      </label>

      <FormField label="HTML *">
        <Textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={14} placeholder="<h1>...</h1>" required />
      </FormField>

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={saving} className="flex-1">Guardar</Button>
      </div>
    </form>
  )
}

export function DocumentTemplatesPage({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<DocumentTemplate | null>(null)
  const [previewing, setPreviewing] = useState<DocumentTemplate | null>(null)
  const [sample, setSample] = useState<string>(() => defaultSample('entrega_equipo'))
  const [rendered, setRendered] = useState<string>('')

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['document-templates'],
    queryFn: () => documentTemplatesApi.list().then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: (d: { name: string; doc_type: DocumentType; html: string; is_default: boolean }) => documentTemplatesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-templates'] })
      setCreating(false)
      toast.success('Plantilla creada')
    },
    onError: () => toast.error('Error al crear plantilla'),
  })

  const update = useMutation({
    mutationFn: (d: { id: number; name: string; doc_type: DocumentType; html: string; is_default: boolean }) =>
      documentTemplatesApi.update(d.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-templates'] })
      setEditing(null)
      toast.success('Plantilla actualizada')
    },
    onError: () => toast.error('Error al actualizar plantilla'),
  })

  const del = useMutation({
    mutationFn: (id: number) => documentTemplatesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-templates'] })
      toast.success('Plantilla eliminada')
    },
    onError: () => toast.error('Error al eliminar plantilla'),
  })

  const render = useMutation({
    mutationFn: (d: { html: string; data_json: string; title?: string }) => documentTemplatesApi.render(d),
    onSuccess: (r) => setRendered(r.data.html),
    onError: () => toast.error('Error al renderizar preview'),
  })

  const grouped = useMemo(() => {
    const map: Record<string, DocumentTemplate[]> = {}
    for (const t of templates) {
      const k = t.doc_type
      map[k] = map[k] || []
      map[k].push(t)
    }
    for (const k of Object.keys(map)) map[k] = map[k].sort((a, b) => a.name.localeCompare(b.name))
    return map
  }, [templates])

  useEffect(() => {
    if (!previewing) return
    setSample(defaultSample(previewing.doc_type))
    setRendered('')
  }, [previewing?.id])

  if (isLoading) return <PageLoader />

  return (
    <div className={embedded ? 'space-y-6' : 'animate-fade-in space-y-6'}>
      {!embedded && (
        <PageHeader
          title="Plantillas de documentos (HTML)"
          subtitle={`${templates.length} plantillas`}
          icon={<FileText size={16} />}
          action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={14} />Nueva plantilla</Button>}
        />
      )}
      {embedded && (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display font-semibold text-text-primary">Plantillas de documentos (HTML)</p>
            <p className="text-xs text-text-muted">{templates.length} plantillas</p>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} />Nueva plantilla</Button>
        </div>
      )}

      <div className="space-y-5">
        {DOC_TYPES.map((t) => (
          <div key={t.value} className="bg-panel border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-display font-semibold text-text-primary">{t.label}</p>
                <p className="text-xs text-text-muted">{(grouped[t.value] || []).length} plantillas</p>
              </div>
              <Badge variant="muted" className="text-[10px] font-mono">{t.value}</Badge>
            </div>
            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {(grouped[t.value] || []).map((tpl) => (
                <div key={tpl.id} className="bg-base border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-sans text-sm text-text-primary truncate">{tpl.name}</p>
                      <div className="mt-2 flex items-center gap-2">
                        {tpl.is_default && <Badge variant="cyan">default</Badge>}
                        <span className="text-[10px] font-mono text-text-muted">
                          {new Date(tpl.updated_at).toLocaleDateString('es-MX')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setPreviewing(tpl)}><Eye size={14} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(tpl)}><Pencil size={14} /></Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="hover:text-red-op"
                        onClick={() => { if (confirm(`¿Eliminar plantilla "${tpl.name}"?`)) del.mutate(tpl.id) }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {(grouped[t.value] || []).length === 0 && (
                <div className="text-sm text-text-muted">No hay plantillas para este tipo.</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva plantilla" width="max-w-3xl">
        <TemplateForm saving={create.isPending} onSave={(d) => create.mutate(d)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Editar plantilla — ${editing?.name ?? ''}`} width="max-w-3xl">
        {editing && (
          <TemplateForm
            initial={editing}
            saving={update.isPending}
            onSave={(d) => update.mutate({ id: editing.id, ...d })}
          />
        )}
      </Modal>

      <Modal open={!!previewing} onClose={() => setPreviewing(null)} title={`Preview — ${previewing?.name ?? ''}`} width="max-w-4xl">
        {previewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FormField label="Sample data_json">
                  <Textarea value={sample} onChange={(e) => setSample(e.target.value)} rows={12} />
                </FormField>
                <Button
                  variant="outline"
                  onClick={() => render.mutate({ html: previewing.html, data_json: sample, title: 'Documento de prueba' })}
                  loading={render.isPending}
                >
                  Renderizar
                </Button>
              </div>
              <div className="bg-elevated border border-border rounded-lg overflow-hidden">
                <iframe title="preview" className="w-full h-[420px]" srcDoc={rendered || '<div style=\"padding:16px;color:#94a3b8;font-family:sans-serif\">Renderiza para ver el preview</div>'} />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

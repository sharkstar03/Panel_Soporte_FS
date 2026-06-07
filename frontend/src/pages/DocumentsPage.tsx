import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Download, Filter } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { documentsApi } from '../api/client'
import type { Document, DocumentStatus, DocumentType } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import toast from 'react-hot-toast'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Input'

const TYPE_LABELS: Record<DocumentType, string> = {
  entrega_equipo: 'Entrega de Equipo',
  control_equipo: 'Control / Inspeccion',
  pago_proveedor: 'Pago a Proveedor',
  checklist_diario: 'Checklist Diario',
}

const TYPE_EMOJI: Record<DocumentType, string> = {
  entrega_equipo: '📦',
  control_equipo: '🔍',
  pago_proveedor: '💰',
  checklist_diario: '✅',
}

const STATUS_LABEL: Record<DocumentStatus, { label: string; badge: 'amber' | 'green' | 'red' }> = {
  pending: { label: 'Pendiente', badge: 'amber' },
  approved: { label: 'Aprobado', badge: 'green' },
  rejected: { label: 'Rechazado', badge: 'red' },
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } } }

export function DocumentsPage() {
  const navigate = useNavigate()
  const [allDocs, setAllDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')

  // Cargar TODOS los documentos (sin filtro de status) para tener contadores reales
  useEffect(() => {
    setLoading(true)
    documentsApi.list({ type: typeFilter || undefined })
      .then(r => setAllDocs(r.data))
      .catch(() => toast.error('Error al cargar documentos'))
      .finally(() => setLoading(false))
  }, [typeFilter])

  // Filtrar por status en el frontend
  const docs = statusFilter
    ? allDocs.filter(d => d.status === statusFilter)
    : allDocs

  const handleDownload = async (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation()
    try {
      const r = await documentsApi.downloadPdf(doc.id)
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.title.replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar PDF')
    }
  }

  // Contadores SIEMPRE basados en allDocs (todos los documentos)
  const counts = {
    all: allDocs.length,
    pending: allDocs.filter(d => d.status === 'pending').length,
    approved: allDocs.filter(d => d.status === 'approved').length,
    rejected: allDocs.filter(d => d.status === 'rejected').length,
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Documentos"
        subtitle="Formularios, actas y registros con aprobacion digital"
        action={
          <Button onClick={() => navigate('/documents/new')} size="sm">
            <Plus size={14} />Nuevo documento
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {([
            ['', 'Todos', counts.all],
            ['pending', 'Pendientes', counts.pending],
            ['approved', 'Aprobados', counts.approved],
            ['rejected', 'Rechazados', counts.rejected],
          ] as [string, string, number][]).map(([v, label, count]) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`relative px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                statusFilter === v
                  ? 'bg-cyan/10 text-cyan border-cyan/40 shadow-md shadow-cyan/10'
                  : 'text-text-secondary border-border hover:border-cyan/30 hover:bg-elevated'
              }`}
            >
              {label}
              <span className={`ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusFilter === v ? 'bg-cyan/20 text-cyan' : 'bg-elevated text-text-muted'}`}>
                {String(count)}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Filter size={14} className="text-text-muted" />
          <Select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {(Object.entries(TYPE_LABELS) as [DocumentType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{TYPE_EMOJI[v]} {l}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-elevated rounded-lg animate-pulse" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-cyan/5 border border-cyan/10 flex items-center justify-center mb-5">
              <FileText size={36} className="text-cyan/30" />
            </div>
            <p className="text-text-primary font-semibold text-base mb-1">No hay documentos</p>
            <p className="text-text-muted text-sm max-w-xs">Crea tu primer documento usando una de las 4 plantillas disponibles.</p>
            <div className="mt-5">
              <Button onClick={() => navigate('/documents/new')} size="md">
                <Plus size={14} />Crear documento
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.table
            variants={container}
            initial="hidden"
            animate="show"
            className="w-full"
          >
            <thead>
              <tr className="border-b border-border">
                {['Tipo', 'Documento', 'Aprobador', 'Fecha', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-sans font-medium text-text-muted uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {docs.map(doc => {
                  const status = STATUS_LABEL[doc.status]
                  return (
                    <motion.tr
                      key={doc.id}
                      variants={item}
                      layout
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className="border-b border-border/50 hover:bg-elevated/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] bg-elevated px-2 py-1 rounded border border-border text-text-muted">
                          <span>{TYPE_EMOJI[doc.type]}</span>
                          {TYPE_LABELS[doc.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-primary font-medium text-sm max-w-[260px] truncate">
                        {doc.title}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs truncate max-w-[180px]">
                        {doc.approver_email}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap font-mono">
                        {new Date(doc.created_at).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.badge} dot className="text-[10px] px-2 py-1 rounded-full">
                          {status.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => handleDownload(e, doc)}
                            className="p-1.5 rounded-md text-text-muted hover:text-cyan hover:bg-cyan/10 transition-colors"
                            title="Descargar PDF"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </motion.table>
        )}
      </div>
    </div>
  )
}

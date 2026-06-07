import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Download, Clock, CheckCircle2, XCircle, FileText, Copy, Check } from 'lucide-react'
import { documentsApi } from '../api/client'
import type { Document, DocumentEvidence, DocumentType } from '../api/types'
import toast from 'react-hot-toast'
import { Button } from '../components/ui/Button'

const TYPE_LABELS: Record<DocumentType, string> = {
  entrega_equipo: 'Entrega de Equipo',
  control_equipo: 'Control / Inspeccion',
  pago_proveedor: 'Pago a Proveedor',
  checklist_diario: 'Checklist Diario',
}

const FIELD_LABELS: Record<string, string> = {
  equipo: 'Equipo', numero_serie: 'N Serie', entregado_a: 'Entregado a',
  sucursal: 'Sucursal', fecha: 'Fecha', condicion: 'Condicion',
  observaciones: 'Observaciones', tecnico: 'Tecnico',
  fecha_inspeccion: 'Fecha de inspeccion', estado_general: 'Estado general',
  proveedor: 'Proveedor', ruc: 'RUC / NIT', servicio: 'Servicio / Producto',
  monto: 'Monto', moneda: 'Moneda', fecha_pago: 'Fecha de pago', notas: 'Notas',
}

const STATUS_CONFIG = {
  approved: {
    icon: CheckCircle2,
    title: 'Aprobado',
    bg: 'bg-green-900/20',
    border: 'border-green-700/40',
    text: 'text-green-400',
    iconColor: 'text-green-400',
  },
  rejected: {
    icon: XCircle,
    title: 'Rechazado',
    bg: 'bg-red-900/20',
    border: 'border-red-700/40',
    text: 'text-red-400',
    iconColor: 'text-red-400',
  },
  pending: {
    icon: Clock,
    title: 'Pendiente de aprobacion',
    bg: 'bg-yellow-900/20',
    border: 'border-yellow-700/40',
    text: 'text-yellow-400',
    iconColor: 'text-yellow-400',
  },
}

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [evidences, setEvidences] = useState<DocumentEvidence[]>([])
  const [evidenceUrls, setEvidenceUrls] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!id) return
    documentsApi.get(Number(id))
      .then(r => setDoc(r.data))
      .catch(() => { toast.error('Documento no encontrado'); navigate('/documents') })
      .finally(() => setLoading(false))
  }, [id, navigate])

  useEffect(() => {
    if (!doc?.id) return
    setEvidences([])
    Object.values(evidenceUrls).forEach((u) => URL.revokeObjectURL(u))
    setEvidenceUrls({})
    documentsApi.listEvidence(doc.id)
      .then(r => setEvidences(r.data))
      .catch(() => {})
  }, [doc?.id])

  useEffect(() => {
    if (!doc?.id) return
    const pending = evidences.filter((e) => e.mime?.startsWith('image/') && !evidenceUrls[e.id])
    if (pending.length === 0) return
    let cancelled = false
    ;(async () => {
      for (const ev of pending) {
        try {
          const r = await documentsApi.downloadEvidence(doc.id, ev.id)
          const url = URL.createObjectURL(r.data)
          if (cancelled) {
            URL.revokeObjectURL(url)
            continue
          }
          setEvidenceUrls((p) => ({ ...p, [ev.id]: url }))
        } catch {}
      }
    })()
    return () => { cancelled = true }
  }, [doc?.id, evidences, evidenceUrls])

  const handleDownload = async () => {
    if (!doc) return
    setDownloading(true)
    try {
      const r = await documentsApi.downloadPdf(doc.id)
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.title.replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Error al descargar') }
    finally { setDownloading(false) }
  }

  const downloadEvidence = async (ev: DocumentEvidence) => {
    if (!doc) return
    try {
      const r = await documentsApi.downloadEvidence(doc.id, ev.id)
      const url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      a.href = url
      a.download = ev.filename || 'evidencia'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo descargar la evidencia')
    }
  }

  const handleCopyToken = () => {
    if (!doc) return
    navigator.clipboard.writeText(doc.token)
    setCopied(true)
    toast.success('Token copiado al portapapeles')
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="text-text-muted text-sm">Cargando...</div>
  if (!doc) return null

  const data = JSON.parse(doc.data_json)
  const tasks: { label: string; done: boolean }[] = data.tasks || []
  const cfg = STATUS_CONFIG[doc.status]
  const StatusIcon = cfg.icon

  const evidencesByItem = evidences.reduce((acc, e) => {
    const k = e.checklist_item || ''
    if (!k) return acc
    if (!acc[k]) acc[k] = []
    acc[k].push(e)
    return acc
  }, {} as Record<string, DocumentEvidence[]>)

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <Button
          onClick={() => navigate('/documents')}
          variant="ghost"
          size="sm"
          className="px-2 py-2"
        >
          <ChevronLeft size={20} />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-text-primary truncate">{doc.title}</h1>
          <p className="text-xs text-text-muted">{TYPE_LABELS[doc.type]} · {new Date(doc.created_at).toLocaleDateString('es')}</p>
        </div>
        <Button onClick={handleDownload} loading={downloading} variant="outline" size="sm">
          <Download size={14} /> {downloading ? 'Descargando...' : 'PDF'}
        </Button>
      </motion.div>

      {/* Status banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className={`flex items-center gap-3 p-4 ${cfg.bg} border ${cfg.border} rounded-xl`}
      >
        <StatusIcon size={24} className={`${cfg.iconColor} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${cfg.text}`}>{cfg.title}</p>
          {doc.status === 'approved' && doc.approved_at && (
            <p className="text-xs text-text-muted">Por: {doc.approver_email} · {new Date(doc.approved_at).toLocaleString('es')}</p>
          )}
          {doc.status === 'rejected' && (
            <p className="text-xs text-text-muted truncate">{doc.rejection_reason}</p>
          )}
          {doc.status === 'pending' && (
            <p className="text-xs text-text-muted">Enviado a: {doc.approver_email}</p>
          )}
        </div>
      </motion.div>

      {/* Token / Link */}
      {doc.status === 'pending' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-panel border border-border rounded-xl p-4"
        >
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Enlace de aprobacion</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-text-secondary bg-elevated rounded-lg px-3 py-2 truncate">
              {`${window.location.origin}/approve/${doc.token}`}
            </code>
            <button
              onClick={handleCopyToken}
              className="p-2 rounded-lg hover:bg-elevated text-text-muted hover:text-cyan transition-colors"
              title="Copiar enlace"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-text-muted mt-2">Valido hasta {new Date(doc.token_expires_at).toLocaleDateString('es')}</p>
        </motion.div>
      )}

      {/* Fields */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-panel border border-border rounded-xl overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-border bg-elevated/30">
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-2">
            <FileText size={12} /> Datos del documento
          </p>
        </div>
        <div className="p-5 space-y-4">
          {Object.entries(data).filter(([k]) => k !== 'tasks' && k !== 'checklist_componentes').map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">{FIELD_LABELS[k] || k.replace(/_/g, ' ')}</p>
              <p className="text-sm text-text-primary">{String(v) || '-'}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Checklist componentes */}
      {data.checklist_componentes && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-panel border border-border rounded-xl overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-border bg-elevated/30">
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Checklist de componentes</p>
          </div>
          <div className="p-5 space-y-2">
            {Object.entries(data.checklist_componentes).map(([item, val]) => (
              <div key={item} className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">{item}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${val === 'OK' ? 'bg-green-900/20 text-green-400' : val === 'Falla' ? 'bg-red-900/20 text-red-400' : 'bg-elevated text-text-muted'}`}>
                  {String(val)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Checklist tasks */}
      {tasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-panel border border-border rounded-xl overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-border bg-elevated/30">
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Tareas del dia</p>
          </div>
          <div className="p-5 space-y-2">
            {tasks.map((t, i) => (
              <div key={i} className={`px-3 py-2.5 rounded-lg border ${t.done ? 'bg-green-900/10 border-green-700/20' : 'border-border'}`}>
                <div className="flex items-center gap-3">
                  {t.done ? <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" /> : <div className="w-4 h-4 rounded-full border border-border flex-shrink-0" />}
                  <span className={`text-sm ${t.done ? 'text-text-primary' : 'text-text-muted'}`}>{t.label}</span>
                </div>
                {evidencesByItem[t.label]?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {evidencesByItem[t.label].map((ev) => (
                      ev.mime?.startsWith('image/')
                        ? (
                          evidenceUrls[ev.id]
                            ? (
                              <a key={ev.id} href={evidenceUrls[ev.id]} target="_blank" rel="noreferrer"
                                className="block border border-border rounded-lg overflow-hidden bg-base hover:border-cyan/40 transition-colors">
                                <img src={evidenceUrls[ev.id]} alt={ev.filename} className="h-20 w-20 object-cover" />
                              </a>
                            ) : (
                              <div key={ev.id} className="h-20 w-20 bg-elevated border border-border rounded-lg animate-pulse" />
                            )
                        )
                        : (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => downloadEvidence(ev)}
                            className="text-xs text-cyan bg-cyan/10 border border-cyan/20 px-2 py-1 rounded hover:bg-cyan/15 transition-colors"
                          >
                            {ev.filename}
                          </button>
                        )
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

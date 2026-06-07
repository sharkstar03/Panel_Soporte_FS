import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Clock, Lock, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { approveApi } from '../api/client'
import type { PublicDocument, DocumentEvidence, DocumentType } from '../api/types'
import { Button } from '../components/ui/Button'
import { Textarea } from '../components/ui/Input'

const TYPE_LABELS: Record<DocumentType, string> = {
  entrega_equipo: 'Entrega de Equipo',
  control_equipo: 'Control / Inspeccion de Equipo',
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

const TC_TEXT: Record<DocumentType, string> = {
  entrega_equipo: `1. Responsabilidad: El receptor declara recibir el equipo en el estado indicado y se hace responsable de su custodia y uso adecuado.\n2. Uso corporativo: El equipo es propiedad de la empresa y debe usarse exclusivamente para actividades laborales autorizadas.\n3. Danos y perdida: Cualquier dano por mal uso o perdida debera ser reportado inmediatamente al area de soporte tecnico.\n4. Devolucion: Al concluir la relacion laboral, el equipo debe ser devuelto en el mismo estado de entrega.\n5. Validez digital: La aprobacion mediante este portal tiene la misma validez que una firma fisica.`,
  control_equipo: `1. Veracidad: El aprobador certifica que la inspeccion fue realizada por personal tecnico calificado y que los resultados reflejan el estado real del equipo.\n2. Seguimiento: Los equipos con estado "Requiere mantenimiento" o "Fuera de servicio" deben ser atendidos en un plazo maximo de 5 dias habiles.\n3. Validez digital: La aprobacion mediante este portal tiene la misma validez que una firma fisica.`,
  pago_proveedor: `1. Autorizacion de pago: El aprobador autoriza el desembolso del monto indicado al proveedor especificado en este documento.\n2. Verificacion: El aprobador confirma haber verificado que el servicio o producto fue recibido de conformidad.\n3. Cumplimiento: El pago se realizara dentro de los plazos acordados y conforme a las politicas financieras de la empresa.\n4. Responsabilidad: El aprobador asume responsabilidad por la exactitud de los datos del proveedor y del monto autorizado.\n5. Validez digital: La aprobacion mediante este portal tiene la misma validez que una firma fisica.`,
  checklist_diario: `1. Veracidad: El aprobador certifica haber revisado el reporte de actividades y que las tareas marcadas como completadas fueron ejecutadas.\n2. Evidencia: Las evidencias adjuntas son parte integral de este reporte y deben conservarse por al menos 30 dias.\n3. Responsabilidad: El supervisor aprobador es responsable de dar seguimiento a las tareas pendientes.\n4. Validez digital: La aprobacion mediante este portal tiene la misma validez que una firma fisica.`,
}

export function ApprovalPage() {
  const { token } = useParams<{ token: string }>()
  const [doc, setDoc] = useState<PublicDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tcAccepted, setTcAccepted] = useState(false)
  const [tcExpanded, setTcExpanded] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'approved' | 'rejected' | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [evidences, setEvidences] = useState<DocumentEvidence[]>([])
  const [evidenceUrls, setEvidenceUrls] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!token) return
    approveApi.get(token)
      .then(r => setDoc(r.data))
      .catch(() => setError('Enlace invalido, expirado o no encontrado'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!token || !doc?.id) return
    setEvidences([])
    Object.values(evidenceUrls).forEach((u) => URL.revokeObjectURL(u))
    setEvidenceUrls({})
    approveApi.listEvidence(token)
      .then(r => setEvidences(r.data))
      .catch(() => {})
  }, [token, doc?.id])

  useEffect(() => {
    if (!token) return
    const pending = evidences.filter((e) => e.mime?.startsWith('image/') && !evidenceUrls[e.id])
    if (pending.length === 0) return
    let cancelled = false
    ;(async () => {
      for (const ev of pending) {
        try {
          const r = await approveApi.downloadEvidence(token, ev.id)
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
  }, [token, evidences, evidenceUrls])

  const isTokenExpired = doc && new Date() > new Date(doc.token_expires_at)
  const isDownloadExpired = doc?.download_expires_at && new Date() > new Date(doc.download_expires_at)

  const handleApprove = async () => {
    if (!token || !tcAccepted) return
    setSubmitting(true)
    try {
      await approveApi.approve(token)
      setResult('approved')
      setDoc(p => p ? { ...p, status: 'approved', approved_at: new Date().toISOString(), download_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString() } : p)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al aprobar')
    } finally { setSubmitting(false) }
  }

  const handleReject = async () => {
    if (!token || !reason.trim()) return
    setSubmitting(true)
    try {
      await approveApi.reject(token, reason.trim())
      setResult('rejected')
      setDoc(p => p ? { ...p, status: 'rejected', rejection_reason: reason.trim() } : p)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al rechazar')
    } finally { setSubmitting(false) }
  }

  const handleDownload = async () => {
    if (!token) return
    setDownloading(true)
    try {
      const r = await approveApi.downloadPdf(token)
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc?.title?.replace(/\s+/g, '_') ?? 'documento'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { setError('Error al descargar') }
    finally { setDownloading(false) }
  }

  const downloadEvidence = async (ev: DocumentEvidence) => {
    if (!token) return
    try {
      const r = await approveApi.downloadEvidence(token, ev.id)
      const url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      a.href = url
      a.download = ev.filename || 'evidencia'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('No se pudo descargar la evidencia')
    }
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-lg bg-panel border border-border rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="bg-elevated/40 px-6 py-4 border-b border-border flex items-center justify-between">
          <span className="font-bold text-cyan text-sm tracking-wide">QUANTIUM CREW</span>
          <span className="text-text-muted text-xs font-mono">Aprobación de Documento</span>
        </div>
        {children}
      </motion.div>
    </div>
  )

  if (loading) return (
    <Shell>
      <div className="p-10 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-8 h-8 border-2 border-cyan border-t-transparent rounded-full mx-auto mb-4"
        />
        <p className="text-text-secondary text-sm">Cargando documento...</p>
      </div>
    </Shell>
  )

  if (error) return (
    <Shell>
      <div className="p-10 text-center">
        <Lock size={40} className="mx-auto mb-3 text-amber-op" />
        <p className="text-amber-op font-semibold text-base">{error}</p>
      </div>
    </Shell>
  )

  if (!doc) return null

  const data = JSON.parse(doc.data_json)
  const tasks: { label: string; done: boolean }[] = data.tasks || []
  const status = result ?? doc.status

  const evidencesByItem = evidences.reduce((acc, e) => {
    const k = e.checklist_item || ''
    if (!k) return acc
    if (!acc[k]) acc[k] = []
    acc[k].push(e)
    return acc
  }, {} as Record<string, DocumentEvidence[]>)

  if (isTokenExpired && status === 'pending') return (
    <Shell>
      <div className="p-10 text-center">
        <Lock size={40} className="mx-auto mb-3 text-amber-op" />
        <p className="text-amber-op font-semibold text-base">Enlace expirado</p>
        <p className="text-text-muted text-sm mt-2">Este enlace ya no es válido. Contacta al equipo de soporte para obtener una copia del documento.</p>
      </div>
    </Shell>
  )

  if (status === 'approved') return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-10 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        >
          <CheckCircle2 size={56} className="mx-auto mb-4 text-green-400" />
        </motion.div>
        <p className="text-green-400 font-bold text-xl mb-1">Documento Aprobado</p>
        <p className="text-text-secondary text-sm mb-1">Aprobado el {doc.approved_at ? new Date(doc.approved_at).toLocaleString('es') : new Date().toLocaleString('es')}</p>
        {doc.download_expires_at && <p className="text-text-muted text-xs mb-6">Descarga disponible hasta: {new Date(doc.download_expires_at).toLocaleString('es')}</p>}
        {!isDownloadExpired ? (
          <Button onClick={handleDownload} loading={downloading} size="lg" className="w-full">
            <Download size={16} />{downloading ? 'Descargando...' : 'Descargar PDF'}
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-amber-op text-sm">
            <Lock size={14} /> El período de descarga ha expirado
          </div>
        )}
      </motion.div>
    </Shell>
  )

  if (status === 'rejected') return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-10 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        >
          <XCircle size={56} className="mx-auto mb-4 text-red-400" />
        </motion.div>
        <p className="text-red-400 font-bold text-xl mb-2">Documento Rechazado</p>
        <div className="bg-red-op/10 border border-red-op/30 rounded-xl p-4 text-left max-w-sm mx-auto">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-1 font-mono">Motivo del rechazo</p>
          <p className="text-sm text-text-primary">{doc.rejection_reason || reason}</p>
        </div>
      </motion.div>
    </Shell>
  )

  return (
    <Shell>
      <div className="p-6 space-y-5">
        {/* Doc summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-elevated/30 border border-border rounded-xl p-5"
        >
          <p className="text-xs text-text-muted uppercase tracking-widest mb-1 font-mono">{TYPE_LABELS[doc.type]}</p>
          <p className="font-semibold text-text-primary text-base mb-4">{doc.title}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {Object.entries(data).filter(([k]) => k !== 'tasks' && k !== 'checklist_componentes').slice(0, 6).map(([k, v]) => (
              <div key={k}>
                <p className="text-[9px] text-text-muted uppercase tracking-widest font-mono">{FIELD_LABELS[k] || k}</p>
                <p className="text-xs text-text-secondary truncate">{String(v) || '-'}</p>
              </div>
            ))}
          </div>
          {tasks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[9px] text-text-muted uppercase tracking-widest mb-2 font-mono">Tareas ({tasks.filter(t => t.done).length}/{tasks.length} completadas)</p>
              <div className="space-y-1.5">
                {tasks.map((t, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-2">
                      {t.done ? <CheckCircle2 size={12} className="text-green-400 flex-shrink-0" /> : <div className="w-3 h-3 rounded-full border border-border flex-shrink-0" />}
                      <span className={t.done ? 'text-text-secondary' : 'text-text-muted'}>{t.label}</span>
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
                                    <img src={evidenceUrls[ev.id]} alt={ev.filename} className="h-16 w-16 object-cover" />
                                  </a>
                                ) : (
                                  <div key={ev.id} className="h-16 w-16 bg-elevated border border-border rounded-lg animate-pulse" />
                                )
                            )
                            : (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={() => downloadEvidence(ev)}
                                className="text-[10px] text-cyan bg-cyan/10 border border-cyan/20 px-2 py-1 rounded hover:bg-cyan/15 transition-colors"
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
            </div>
          )}
        </motion.div>

        {/* T&C */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-elevated/30 border border-border rounded-xl p-5"
        >
          <div className="flex items-start gap-3">
            <input type="checkbox" checked={tcAccepted} onChange={(e) => setTcAccepted(e.target.checked)} className="w-4 h-4 accent-cyan rounded mt-0.5" />
            <div className="text-xs text-text-secondary leading-relaxed">
              He leído y acepto los{' '}
              <button type="button" onClick={() => setTcExpanded(p => !p)}
                className="text-cyan underline inline-flex items-center gap-0.5">
                Terminos y Condiciones
                {tcExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>{' '}
              de este documento y autorizo esta accion de forma digital.
            </div>
          </div>
          <AnimatePresence>
            {tcExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 bg-panel border border-cyan/30 rounded-lg p-3 text-[10px] text-text-secondary leading-relaxed max-h-32 overflow-y-auto whitespace-pre-line">
                  {TC_TEXT[doc.type]}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-3"
        >
          <Button onClick={handleApprove} disabled={!tcAccepted} loading={submitting} className="flex-1">
            Aprobar
          </Button>
          <Button onClick={() => { setShowReject(p => !p); setReason('') }} disabled={submitting} variant="danger" className="flex-1">
            Rechazar
          </Button>
        </motion.div>

        {/* Rejection reason */}
        <AnimatePresence>
          {showReject && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-red-op/10 border border-red-op/30 rounded-xl p-5 space-y-3">
                <p className="text-xs text-red-op font-medium uppercase tracking-widest font-mono">Motivo del rechazo (requerido)</p>
                <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                  placeholder="Ej: El número de serie no coincide con el inventario. Por favor verificar antes de proceder." />
                <div className="flex gap-2">
                  <Button onClick={handleReject} disabled={!reason.trim()} loading={submitting} variant="danger" className="flex-1">
                    Confirmar rechazo
                  </Button>
                  <Button onClick={() => { setShowReject(false); setReason('') }} variant="ghost">
                    Cancelar
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-text-muted text-[10px] flex items-center justify-center gap-1">
          <Clock size={10} /> Enlace valido hasta {new Date(doc.token_expires_at).toLocaleDateString('es')}
        </p>
      </div>
    </Shell>
  )
}

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Trash2, FileText, ClipboardList, ShieldAlert, Eye, X } from 'lucide-react'
import { adminApi } from '../api/client'
import toast from 'react-hot-toast'

// ── Types ──────────────────────────────────────────────────────────────────

type PurgeTarget = 'documents' | 'sessions' | 'audit'

interface Preview {
  documents: number
  sessions: number
  audit_events: number
}

// ── Sub-component: confirm dialog ──────────────────────────────────────────

interface ConfirmDialogProps {
  title: string
  description: string
  count: number
  onConfirm: () => Promise<void>
  onCancel: () => void
}

function ConfirmDialog({ title, description, count, onConfirm, onCancel }: ConfirmDialogProps) {
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)

  const handleConfirm = async () => {
    if (input !== 'CONFIRMAR') return
    setRunning(true)
    try {
      await onConfirm()
    } finally {
      setRunning(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="w-full max-w-md bg-[#0d0808] border border-red-900/60 rounded-2xl overflow-hidden shadow-2xl shadow-red-900/30"
      >
        {/* Header */}
        <div className="bg-red-950/40 border-b border-red-900/40 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-900/60 border border-red-700/40 flex items-center justify-center">
              <AlertTriangle size={14} className="text-red-400" />
            </div>
            <span className="font-semibold text-red-300 text-sm">{title}</span>
          </div>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary transition-colors p-1 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">{description}</p>

          {/* Count badge */}
          <div className="flex items-center gap-3 bg-red-950/30 border border-red-900/30 rounded-lg px-4 py-3">
            <Trash2 size={16} className="text-red-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Registros a eliminar</p>
              <p className="text-2xl font-bold text-red-300 font-mono leading-none mt-0.5">{count.toLocaleString()}</p>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2.5 bg-amber-950/20 border border-amber-800/30 rounded-lg px-3 py-2.5">
            <AlertTriangle size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-300/80 leading-relaxed">
              Esta acción es <strong className="text-amber-300">irreversible</strong>. Los registros eliminados no pueden recuperarse.
            </p>
          </div>

          {/* Confirmation input */}
          <div>
            <label className="block text-xs text-text-muted mb-2">
              Escribe <span className="font-mono font-bold text-red-400">CONFIRMAR</span> para continuar
            </label>
            <input
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              placeholder="CONFIRMAR"
              className="w-full bg-[#1a0808] border border-red-900/50 focus:border-red-600 rounded-lg px-3 py-2.5 text-sm font-mono text-red-200 placeholder-red-900/50 focus:outline-none transition-colors"
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:bg-elevated transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={input !== 'CONFIRMAR' || running}
              className="flex-1 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={14} />
              {running ? 'Eliminando...' : 'Eliminar definitivamente'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Sub-component: purge card ──────────────────────────────────────────────

interface PurgeCardProps {
  icon: React.ElementType
  title: string
  description: string
  target: PurgeTarget
  extraOptions?: React.ReactNode
  onExecute: (days: number) => Promise<{ deleted: number }>
  previewCount?: number
}

function PurgeCard({
  icon: Icon,
  title,
  description,
  target,
  extraOptions,
  onExecute,
  previewCount,
}: PurgeCardProps) {
  const [days, setDays] = useState(30)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<number | null>(null)

  const handleExecute = async () => {
    const result = await onExecute(days)
    setLastResult(result.deleted)
    setShowConfirm(false)
    if (result.deleted > 0) {
      toast.success(`${result.deleted} registros eliminados correctamente`)
    } else {
      toast(`No había registros que cumplan el criterio`, { icon: 'ℹ️' })
    }
  }

  return (
    <>
      <AnimatePresence>
        {showConfirm && (
          <ConfirmDialog
            title={`Eliminar ${title.toLowerCase()}`}
            description={`Se eliminarán todos los registros de ${title.toLowerCase()} con más de ${days} días de antigüedad. Esta operación no se puede deshacer.`}
            count={previewCount ?? 0}
            onConfirm={handleExecute}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </AnimatePresence>

      <div className="bg-[#0d0808] border border-red-900/30 rounded-xl overflow-hidden hover:border-red-800/50 transition-colors">
        {/* Card header */}
        <div className="px-5 py-4 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-950/50 border border-red-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon size={18} className="text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-primary text-sm mb-1">{title}</h3>
            <p className="text-xs text-text-muted leading-relaxed">{description}</p>
          </div>
          {lastResult !== null && (
            <span className="text-[10px] font-mono text-green-400 bg-green-900/20 border border-green-700/30 px-2 py-0.5 rounded-full flex-shrink-0">
              -{lastResult} eliminados
            </span>
          )}
        </div>

        {/* Card body */}
        <div className="px-5 pb-4 space-y-3 border-t border-red-900/20 pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">
                Registros anteriores a
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={3650}
                  value={days}
                  onChange={e => setDays(Math.max(0, Number(e.target.value)))}
                  className="w-20 bg-[#1a0808] border border-red-900/40 focus:border-red-700 rounded-lg px-3 py-2 text-sm font-mono text-red-200 focus:outline-none transition-colors"
                />
                <span className="text-sm text-text-muted">días</span>
              </div>
            </div>
            {extraOptions}
          </div>

          <div className="flex items-center gap-3">
            {previewCount !== undefined && (
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <Eye size={12} />
                <span>
                  ~<span className={`font-semibold font-mono ${previewCount > 0 ? 'text-red-400' : 'text-text-muted'}`}>
                    {previewCount}
                  </span> registros afectados
                </span>
              </div>
            )}
            <button
              onClick={() => setShowConfirm(true)}
              disabled={loading}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-red-950/60 hover:bg-red-900/60 border border-red-800/40 hover:border-red-700/60 text-red-300 hover:text-red-200 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            >
              <Trash2 size={13} />
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export function DangerZone() {
  const [days, setDays] = useState(30)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [docStatus, setDocStatus] = useState('all')
  const [onlyClosed, setOnlyClosed] = useState(true)

  const loadPreview = async () => {
    setLoadingPreview(true)
    try {
      const r = await adminApi.purgePreview(days)
      setPreview(r.data)
    } catch {
      toast.error('No se pudo cargar la vista previa')
    } finally {
      setLoadingPreview(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="flex items-start gap-4 bg-red-950/20 border border-red-800/40 rounded-xl px-5 py-4">
        <div className="w-10 h-10 rounded-full bg-red-900/40 border border-red-700/40 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={18} className="text-red-400" />
        </div>
        <div>
          <h2 className="font-bold text-red-300 text-sm mb-1">Zona de Peligro — Solo Administradores</h2>
          <p className="text-xs text-text-muted leading-relaxed">
            Las acciones en esta sección son <strong className="text-red-400">permanentes e irreversibles</strong>.
            Eliminar registros afecta el historial del sistema. Se recomienda hacer un respaldo de base de datos antes de proceder.
            Todas las operaciones quedan registradas en el log de auditoría.
          </p>
        </div>
      </div>

      {/* Global preview */}
      <div className="bg-panel border border-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Eye size={15} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Vista previa de impacto</h3>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Antigüedad</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={days}
                onChange={e => setDays(Math.max(0, Number(e.target.value)))}
                className="w-20 bg-base border border-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-cyan/50 transition-colors"
              />
              <span className="text-sm text-text-muted">días</span>
            </div>
          </div>
          <button
            onClick={loadPreview}
            disabled={loadingPreview}
            className="flex items-center gap-2 px-4 py-2 bg-elevated border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-cyan/40 transition-all disabled:opacity-50"
          >
            <Eye size={14} />
            {loadingPreview ? 'Calculando...' : 'Ver impacto'}
          </button>
        </div>

        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 grid grid-cols-3 gap-3"
          >
            {[
              { label: 'Documentos', value: preview.documents, icon: FileText, color: preview.documents > 0 ? 'text-red-400' : 'text-text-muted' },
              { label: 'Sesiones (cerradas)', value: preview.sessions, icon: ClipboardList, color: preview.sessions > 0 ? 'text-red-400' : 'text-text-muted' },
              { label: 'Eventos de auditoría', value: preview.audit_events, icon: ShieldAlert, color: preview.audit_events > 0 ? 'text-red-400' : 'text-text-muted' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-elevated/50 border border-border rounded-lg px-4 py-3 text-center">
                <Icon size={16} className={`mx-auto mb-1.5 ${color}`} />
                <p className={`text-xl font-bold font-mono ${color}`}>{value.toLocaleString()}</p>
                <p className="text-xs text-text-muted mt-0.5">{label}</p>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Purge cards */}
      <PurgeCard
        icon={FileText}
        title="Documentos"
        description="Elimina documentos y sus evidencias adjuntas según su antigüedad y estado. Los documentos eliminados no podrán recuperarse."
        target="documents"
        previewCount={preview?.documents}
        extraOptions={
          <div>
            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Estado</label>
            <select
              value={docStatus}
              onChange={e => setDocStatus(e.target.value)}
              className="bg-[#1a0808] border border-red-900/40 rounded-lg px-3 py-2 text-sm text-red-200 focus:outline-none"
            >
              <option value="all">Todos</option>
              <option value="pending">Solo pendientes</option>
              <option value="approved">Solo aprobados</option>
              <option value="rejected">Solo rechazados</option>
            </select>
          </div>
        }
        onExecute={async (d) => {
          const r = await adminApi.purgeDocuments(d, docStatus)
          return r.data
        }}
      />

      <PurgeCard
        icon={ClipboardList}
        title="Sesiones de Soporte"
        description="Elimina sesiones de soporte técnico y sus eventos asociados. Solo sesiones cerradas son elegibles por defecto."
        target="sessions"
        previewCount={preview?.sessions}
        extraOptions={
          <label className="flex items-center gap-2 cursor-pointer pb-1">
            <input
              type="checkbox"
              checked={onlyClosed}
              onChange={e => setOnlyClosed(e.target.checked)}
              className="w-4 h-4 accent-red-500 rounded"
            />
            <span className="text-xs text-text-muted">Solo cerradas</span>
          </label>
        }
        onExecute={async (d) => {
          const r = await adminApi.purgeSessions(d, onlyClosed)
          return r.data
        }}
      />

      <PurgeCard
        icon={ShieldAlert}
        title="Log de Auditoría"
        description="Elimina eventos de auditoría huérfanos (sin sesión asociada) anteriores al período indicado. Mantiene el log de sesiones activas."
        target="audit"
        previewCount={preview?.audit_events}
        onExecute={async (d) => {
          const r = await adminApi.purgeAudit(d)
          return r.data
        }}
      />
    </div>
  )
}

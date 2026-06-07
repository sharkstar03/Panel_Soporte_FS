import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { documentsApi, usersApi } from '../api/client'
import type { DocumentType } from '../api/types'
import type { TaskState } from './documents/ChecklistDiarioForm'
import { EntregaEquipoForm } from './documents/EntregaEquipoForm'
import { ControlEquipoForm } from './documents/ControlEquipoForm'
import { PagoProveedorForm } from './documents/PagoProveedorForm'
import { ChecklistDiarioForm } from './documents/ChecklistDiarioForm'
import toast from 'react-hot-toast'
import { Button } from '../components/ui/Button'
import { useQuery } from '@tanstack/react-query'
import type { SupervisorUser } from '../api/types'

interface Template {
  type: DocumentType
  label: string
  desc: string
  emoji: string
  gradient: string
  border: string
  iconBg: string
}

const TEMPLATES: Template[] = [
  {
    type: 'entrega_equipo',
    label: 'Entrega de Equipo',
    desc: 'Registro formal de entrega a empleado o area con constancia digital.',
    emoji: '📦',
    gradient: 'from-cyan/20 to-cyan/5',
    border: 'border-cyan/30 hover:border-cyan',
    iconBg: 'bg-cyan/10 text-cyan',
  },
  {
    type: 'control_equipo',
    label: 'Control / Inspeccion',
    desc: 'Revision periodica del estado de un equipo con checklist de componentes.',
    emoji: '🔍',
    gradient: 'from-blue-400/20 to-blue-400/5',
    border: 'border-blue-400/30 hover:border-blue-400',
    iconBg: 'bg-blue-400/10 text-blue-400',
  },
  {
    type: 'pago_proveedor',
    label: 'Pago a Proveedor',
    desc: 'Solicitud de pago con terminos, condiciones y aprobacion del CFO.',
    emoji: '💰',
    gradient: 'from-purple-400/20 to-purple-400/5',
    border: 'border-purple-400/30 hover:border-purple-400',
    iconBg: 'bg-purple-400/10 text-purple-400',
  },
  {
    type: 'checklist_diario',
    label: 'Checklist Diario',
    desc: 'Tareas del dia con evidencia fotografica y seguimiento de cumplimiento.',
    emoji: '✅',
    gradient: 'from-green-400/20 to-green-400/5',
    border: 'border-green-400/30 hover:border-green-400',
    iconBg: 'bg-green-400/10 text-green-400',
  },
]

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 30 } },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
}

export function NewDocumentPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'select' | 'fill'>('select')
  const [selected, setSelected] = useState<Template | null>(null)
  const [loading, setLoading] = useState(false)
  const [dir, setDir] = useState(1)

  const { data: supervisors = [] } = useQuery({
    queryKey: ['supervisors'],
    queryFn: () => usersApi.supervisors().then((r) => r.data),
  })

  const handleSelect = (t: Template) => {
    setDir(1)
    setSelected(t)
    setStep('fill')
  }

  const handleBack = () => {
    setDir(-1)
    setStep('select')
    setSelected(null)
  }

  const handleSubmit = async (title: string, data_json: string, approver_email: string, tasks?: TaskState[]) => {
    if (!selected) return
    setLoading(true)
    try {
      const r = await documentsApi.create({ type: selected.type, title, data_json, approver_email })
      const docId = r.data.id

      if (selected.type === 'checklist_diario' && tasks) {
        const uploads = tasks.filter(t => t.evidence).map(t =>
          documentsApi.uploadEvidence(docId, t.label, t.evidence!)
        )
        await Promise.allSettled(uploads)
      }

      toast.success('Documento creado y enviado para aprobacion')
      navigate(`/documents/${docId}`)
    } catch {
      toast.error('Error al crear el documento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Button
          onClick={() => (step === 'fill' ? handleBack() : navigate('/documents'))}
          variant="ghost"
          size="sm"
          className="px-2 py-2"
        >
          <ChevronLeft size={20} />
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            {step === 'select' ? 'Nuevo documento' : selected?.label}
          </h1>
          <p className="text-xs text-text-muted">
            {step === 'select' ? 'Elige una plantilla para comenzar' : 'Completa los campos y envia para aprobacion'}
          </p>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        <div className={`h-1.5 flex-1 rounded-full transition-colors ${step !== 'select' ? 'bg-cyan' : 'bg-cyan'}`} />
        <div className={`h-1.5 flex-1 rounded-full transition-colors ${step === 'fill' ? 'bg-cyan' : 'bg-border'}`} />
      </div>

      <AnimatePresence mode="wait" custom={dir}>
        {step === 'select' ? (
          <motion.div
            key="select"
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TEMPLATES.map(t => (
                <button
                  key={t.type}
                  onClick={() => handleSelect(t)}
                  className={`group relative text-left bg-panel border rounded-xl p-6 transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden ${t.border}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-xl ${t.iconBg} flex items-center justify-center text-2xl mb-4`}>
                      {t.emoji}
                    </div>
                    <h3 className="font-semibold text-text-primary text-sm mb-1 group-hover:text-cyan transition-colors">
                      {t.label}
                    </h3>
                    <p className="text-xs text-text-muted leading-relaxed">{t.desc}</p>
                    <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-cyan opacity-0 group-hover:opacity-100 transition-opacity">
                      <FileText size={12} /> SELECCIONAR
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="fill"
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <div className="bg-panel border border-border rounded-xl p-6 shadow-sm">
              {selected?.type === 'entrega_equipo' && <EntregaEquipoForm onSubmit={handleSubmit} loading={loading} supervisors={supervisors as SupervisorUser[]} />}
              {selected?.type === 'control_equipo' && <ControlEquipoForm onSubmit={handleSubmit} loading={loading} supervisors={supervisors as SupervisorUser[]} />}
              {selected?.type === 'pago_proveedor' && <PagoProveedorForm onSubmit={handleSubmit} loading={loading} supervisors={supervisors as SupervisorUser[]} />}
              {selected?.type === 'checklist_diario' && (
                <ChecklistDiarioForm
                  onSubmit={(title, data_json, email, tasks) => handleSubmit(title, data_json, email, tasks)}
                  loading={loading}
                  supervisors={supervisors as SupervisorUser[]}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { Paperclip, CheckCircle2, Circle, RefreshCw } from 'lucide-react'
import { documentsApi } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { FormField, Input, Select, Textarea } from '../../components/ui/Input'
import type { SupervisorUser } from '../../api/types'

interface FormProps {
  onSubmit: (title: string, data_json: string, approver_email: string, tasks?: TaskState[]) => void
  loading: boolean
  supervisors: SupervisorUser[]
}

export interface TaskState {
  label: string
  done: boolean
  evidence: File | null
}

const DEFAULT_TASKS = [
  'Backup de servidores',
  'Monitoreo de red',
  'Actualización de sistemas',
  'Revisión UPS',
  'Limpieza de logs',
  'Verificación de antivirus',
  'Revisión de tickets pendientes',
  'Informe de incidencias',
]

export function ChecklistDiarioForm({ onSubmit, loading, supervisors }: FormProps) {
  const [tecnico, setTecnico] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [observaciones, setObservaciones] = useState('')
  const [correo, setCorreo] = useState('')
  const [tasks, setTasks] = useState<TaskState[]>(
    DEFAULT_TASKS.map(label => ({ label, done: false, evidence: null }))
  )
  const [loadingTasks, setLoadingTasks] = useState(true)
  const fileRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    documentsApi.checklistItems()
      .then(r => {
        const items = r.data.items
        if (items.length > 0) {
          setTasks(items.map(label => ({ label, done: false, evidence: null })))
        }
      })
      .catch(() => {/* usa los defaults */})
      .finally(() => setLoadingTasks(false))
  }, [])

  const toggleDone = (i: number) =>
    setTasks(p => p.map((t, idx) => idx === i ? { ...t, done: !t.done } : t))

  const setEvidence = (i: number, file: File | null) =>
    setTasks(p => p.map((t, idx) => idx === i ? { ...t, evidence: file } : t))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      tecnico,
      fecha,
      observaciones,
      tasks: tasks.map(t => ({ label: t.label, done: t.done })),
    }
    const title = `Checklist — ${tecnico || 'Técnico'} · ${fecha}`
    onSubmit(title, JSON.stringify(data), correo, tasks)
  }

  const completedCount = tasks.filter(t => t.done).length
  const valid = fecha && correo

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Técnico">
          <Input value={tecnico} onChange={e => setTecnico(e.target.value)} placeholder="Carlos Méndez" />
        </FormField>
        <FormField label="Fecha *">
          <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required />
        </FormField>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
            Tareas del día
          </label>
          <div className="flex items-center gap-2">
            {loadingTasks && <RefreshCw size={12} className="text-text-muted animate-spin" />}
            <span className="text-xs text-text-muted">
              <span className="text-cyan font-semibold">{completedCount}</span>/{tasks.length} completadas
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-elevated rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }}
          />
        </div>

        <div className="space-y-1.5">
          {tasks.map((task, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                task.done
                  ? 'bg-green-900/10 border-green-700/30'
                  : 'bg-base border-border hover:border-border/80'
              }`}
            >
              <button type="button" onClick={() => toggleDone(i)} className="flex-shrink-0">
                {task.done
                  ? <CheckCircle2 size={18} className="text-green-400" />
                  : <Circle size={18} className="text-text-muted" />}
              </button>
              <span className={`flex-1 text-sm ${task.done ? 'text-text-primary line-through opacity-70' : 'text-text-secondary'}`}>
                {task.label}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                ref={el => { fileRefs.current[i] = el }}
                onChange={e => setEvidence(i, e.target.files?.[0] ?? null)}
              />
              {task.evidence ? (
                <button
                  type="button"
                  onClick={() => fileRefs.current[i]?.click()}
                  className="text-xs text-cyan flex items-center gap-1 bg-cyan/10 border border-cyan/20 px-2 py-0.5 rounded"
                >
                  <Paperclip size={10} />
                  <span className="max-w-[80px] truncate">{task.evidence.name}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRefs.current[i]?.click()}
                  className="text-xs text-text-muted hover:text-cyan flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-elevated"
                >
                  <Paperclip size={10} /> Evidencia
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <FormField label="Observaciones del día">
        <Textarea
          rows={3}
          value={observaciones}
          onChange={e => setObservaciones(e.target.value)}
          placeholder="Incidencias, novedades del día..."
        />
      </FormField>

      <div className="border-t border-border pt-4">
        <FormField label="Supervisor aprobador *">
          <Select value={correo} onChange={(e) => setCorreo(e.target.value)} required>
            <option value="">Seleccionar supervisor...</option>
            {supervisors.map(s => <option key={s.id} value={s.username}>{s.username}</option>)}
          </Select>
        </FormField>
      </div>

      <div className="bg-elevated/50 border border-border rounded-lg px-4 py-3 flex items-start gap-2.5">
        <Paperclip size={13} className="text-text-muted mt-0.5 flex-shrink-0" />
        <p className="text-xs text-text-muted leading-relaxed">
          Las evidencias adjuntas se subirán automáticamente al crear el documento.
          Las tareas del checklist son configurables desde <strong className="text-text-secondary">Configuraciones → Módulo de Documentos</strong>.
        </p>
      </div>

      <Button type="submit" disabled={!valid} loading={loading} className="w-full">
        {loading ? 'Enviando...' : `Enviar checklist del día (${completedCount}/${tasks.length}) →`}
      </Button>
    </form>
  )
}

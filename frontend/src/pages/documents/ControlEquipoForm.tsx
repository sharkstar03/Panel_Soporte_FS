import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { FormField, Input, Select, Textarea } from '../../components/ui/Input'
import type { SupervisorUser } from '../../api/types'

interface FormProps {
  onSubmit: (title: string, data_json: string, approver_email: string) => void
  loading: boolean
  supervisors: SupervisorUser[]
}

const ESTADO_OPTIONS = ['Óptimo', 'Funcional', 'Requiere mantenimiento', 'Fuera de servicio']
const CHECKLIST_ITEMS = [
  'Pantalla / Monitor', 'Teclado', 'Mouse / Touchpad', 'Puertos USB',
  'Ventilación / Temperatura', 'Batería (laptops)', 'Disco duro / SSD', 'RAM',
]

export function ControlEquipoForm({ onSubmit, loading, supervisors }: FormProps) {
  const [f, setF] = useState({
    equipo: '', tecnico: '', sucursal: '',
    fecha_inspeccion: new Date().toISOString().split('T')[0],
    estado_general: 'Funcional', observaciones: '', correo_aprobador: '',
  })
  const [checks, setChecks] = useState<Record<string, string>>(
    Object.fromEntries(CHECKLIST_ITEMS.map(i => [i, 'OK']))
  )

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { correo_aprobador, ...fields } = f
    const data = { ...fields, checklist_componentes: checks }
    const title = `Inspección — ${f.equipo} · ${f.fecha_inspeccion}`
    onSubmit(title, JSON.stringify(data), correo_aprobador)
  }

  const valid = f.equipo && f.fecha_inspeccion && f.correo_aprobador

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Equipo *"><Input value={f.equipo} onChange={set('equipo')} placeholder="PC-04 Sucursal Norte" required /></FormField>
        <FormField label="Técnico"><Input value={f.tecnico} onChange={set('tecnico')} placeholder="Carlos Méndez" /></FormField>
        <FormField label="Sucursal"><Input value={f.sucursal} onChange={set('sucursal')} placeholder="Sede Norte" /></FormField>
        <FormField label="Fecha de inspección *"><Input type="date" value={f.fecha_inspeccion} onChange={set('fecha_inspeccion')} required /></FormField>
      </div>
      <div>
        <label className="block text-xs font-mono text-text-secondary uppercase tracking-widest mb-2">Checklist de componentes</label>
        <div className="space-y-1.5">
          {CHECKLIST_ITEMS.map(item => (
            <div key={item} className="flex items-center justify-between bg-base border border-border rounded px-3 py-2">
              <span className="text-sm text-text-secondary">{item}</span>
              <Select
                className="!w-auto !px-2 !py-1 !text-xs"
                value={checks[item]}
                onChange={e => setChecks(p => ({ ...p, [item]: e.target.value }))}
              >
                {['OK', 'Falla', 'N/A'].map(o => <option key={o}>{o}</option>)}
              </Select>
            </div>
          ))}
        </div>
      </div>
      <FormField label="Estado general">
        <Select value={f.estado_general} onChange={set('estado_general') as any}>
          {ESTADO_OPTIONS.map(o => <option key={o}>{o}</option>)}
        </Select>
      </FormField>
      <FormField label="Observaciones">
        <Textarea rows={3} value={f.observaciones} onChange={set('observaciones')} placeholder="Detalles adicionales..." />
      </FormField>
      <div className="border-t border-border pt-4">
        <FormField label="Supervisor aprobador *">
          <Select value={f.correo_aprobador} onChange={set('correo_aprobador') as any} required>
            <option value="">Seleccionar supervisor...</option>
            {supervisors.map(s => <option key={s.id} value={s.username}>{s.username}</option>)}
          </Select>
        </FormField>
      </div>
      <Button type="submit" disabled={!valid} loading={loading} className="w-full">
        {loading ? 'Enviando...' : 'Enviar para aprobar →'}
      </Button>
    </form>
  )
}

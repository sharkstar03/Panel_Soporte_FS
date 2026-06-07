import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { FormField, Input, Select, Textarea } from '../../components/ui/Input'
import type { SupervisorUser } from '../../api/types'

interface FormProps {
  onSubmit: (title: string, data_json: string, approver_email: string) => void
  loading: boolean
  supervisors: SupervisorUser[]
}

const CONDICION_OPTIONS = ['Nuevo', 'Buen estado', 'Regular', 'Dañado']

export function EntregaEquipoForm({ onSubmit, loading, supervisors }: FormProps) {
  const [f, setF] = useState({
    equipo: '', numero_serie: '', entregado_a: '', sucursal: '',
    fecha: new Date().toISOString().split('T')[0], condicion: 'Buen estado',
    observaciones: '', correo_aprobador: '',
  })

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { correo_aprobador, ...fields } = f
    const title = `Entrega — ${f.equipo} · ${f.entregado_a}`
    onSubmit(title, JSON.stringify(fields), correo_aprobador)
  }

  const valid = f.equipo && f.entregado_a && f.fecha && f.correo_aprobador

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Equipo *"><Input value={f.equipo} onChange={set('equipo')} placeholder="Laptop HP EliteBook" required /></FormField>
        <FormField label="N° de Serie"><Input value={f.numero_serie} onChange={set('numero_serie')} placeholder="HP-2024-00421" /></FormField>
        <FormField label="Entregado a *"><Input value={f.entregado_a} onChange={set('entregado_a')} placeholder="Nombre completo" required /></FormField>
        <FormField label="Sucursal"><Input value={f.sucursal} onChange={set('sucursal')} placeholder="Sede Central" /></FormField>
        <FormField label="Fecha *"><Input type="date" value={f.fecha} onChange={set('fecha')} required /></FormField>
        <FormField label="Condición">
          <Select value={f.condicion} onChange={set('condicion') as any}>
            {CONDICION_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </Select>
        </FormField>
      </div>
      <FormField label="Observaciones">
        <Textarea rows={3} value={f.observaciones} onChange={set('observaciones')} placeholder="Incluye cargador y funda..." />
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

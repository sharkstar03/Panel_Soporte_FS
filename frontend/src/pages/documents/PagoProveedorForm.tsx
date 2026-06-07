import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { FormField, Input, Select, Textarea } from '../../components/ui/Input'
import type { SupervisorUser } from '../../api/types'

interface FormProps {
  onSubmit: (title: string, data_json: string, approver_email: string) => void
  loading: boolean
  supervisors: SupervisorUser[]
}

export function PagoProveedorForm({ onSubmit, loading, supervisors }: FormProps) {
  const [f, setF] = useState({
    proveedor: '', ruc: '', servicio: '', monto: '', moneda: 'USD',
    fecha_pago: '', notas: '', correo_aprobador: '',
  })

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { correo_aprobador, ...fields } = f
    const title = `Pago — ${f.proveedor} · ${f.moneda} ${f.monto}`
    onSubmit(title, JSON.stringify(fields), correo_aprobador)
  }

  const valid = f.proveedor && f.monto && f.correo_aprobador

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Proveedor *"><Input value={f.proveedor} onChange={set('proveedor')} placeholder="Tecnosol S.A." required /></FormField>
        <FormField label="RUC / NIT"><Input value={f.ruc} onChange={set('ruc')} placeholder="20512345678" /></FormField>
      </div>
      <FormField label="Servicio / Producto"><Input value={f.servicio} onChange={set('servicio')} placeholder="Soporte técnico mensual" /></FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Monto total *"><Input value={f.monto} onChange={set('monto')} placeholder="1500.00" required /></FormField>
        <FormField label="Moneda">
          <Select value={f.moneda} onChange={set('moneda') as any}>
            {['USD', 'EUR', 'PEN', 'MXN', 'COP', 'CLP', 'ARS'].map(c => <option key={c}>{c}</option>)}
          </Select>
        </FormField>
        <FormField label="Fecha de pago"><Input type="date" value={f.fecha_pago} onChange={set('fecha_pago')} /></FormField>
      </div>
      <FormField label="Notas adicionales">
        <Textarea rows={3} value={f.notas} onChange={set('notas')} placeholder="Condiciones de pago, observaciones..." />
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

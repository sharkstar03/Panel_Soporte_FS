import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShieldAlert, Filter } from 'lucide-react'
import { auditApi } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
const eventTypes: string[] = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'SESSION_CREATED',
  'CONNECT_CLICKED',
  'SESSION_CLOSED',
  'ATTACHMENT_ADDED',
  'ATTACHMENT_DOWNLOADED',
  'ASSET_CREATED',
  'ASSET_UPDATED',
  'ASSET_DELETED',
  'USER_CREATED',
  'LINK_CREATED',
  'LINK_DELETED',
  'KB_CREATED',
  'KB_UPDATED',
  'KB_DELETED',
  'SETTING_UPDATED',
  'PASSWORD_CREATED',
  'PASSWORD_DELETED',
  'PASSWORD_VIEWED',
  'OTP_CREATED',
  'OTP_DELETED',
  'OTP_VIEWED',
  'SECKEY_CREATED',
  'SECKEY_DELETED',
  'SECKEY_VIEWED',
  'DOCUMENT_CREATED',
  'DOCUMENT_APPROVED',
  'DOCUMENT_REJECTED',
  'DOCUMENT_DOWNLOADED',
]

const typeLabels: Record<string, string> = {
  LOGIN_SUCCESS: 'Login exitoso',
  LOGIN_FAILED: 'Login fallido',
  SESSION_CREATED: 'Sesión creada',
  CONNECT_CLICKED: 'Conexión iniciada',
  SESSION_CLOSED: 'Sesión cerrada',
  ATTACHMENT_ADDED: 'Adjunto agregado',
  ATTACHMENT_DOWNLOADED: 'Adjunto descargado',
  ASSET_CREATED: 'Activo creado',
  ASSET_UPDATED: 'Activo actualizado',
  ASSET_DELETED: 'Activo eliminado',
  USER_CREATED: 'Usuario creado',
  LINK_CREATED: 'Link creado',
  LINK_DELETED: 'Link eliminado',
  KB_CREATED: 'Artículo KB creado',
  KB_UPDATED: 'Artículo KB actualizado',
  KB_DELETED: 'Artículo KB eliminado',
  SETTING_UPDATED: 'Configuración actualizada',
  PASSWORD_CREATED: 'Credencial creada',
  PASSWORD_DELETED: 'Credencial eliminada',
  PASSWORD_VIEWED: 'Credencial revelada',
  OTP_CREATED: 'OTP creado',
  OTP_DELETED: 'OTP eliminado',
  OTP_VIEWED: 'OTP revelado',
  SECKEY_CREATED: 'Clave de seguridad creada',
  SECKEY_DELETED: 'Clave de seguridad eliminada',
  SECKEY_VIEWED: 'Clave de seguridad revelada',
  DOCUMENT_CREATED: 'Documento creado',
  DOCUMENT_APPROVED: 'Documento aprobado',
  DOCUMENT_REJECTED: 'Documento rechazado',
  DOCUMENT_DOWNLOADED: 'Documento descargado',
}

const typeBadgeVariant = (type: string) => {
  if (type === 'LOGIN_FAILED' || type === 'ASSET_DELETED' || type === 'LINK_DELETED' || type === 'KB_DELETED') return 'red'
  if (type === 'LOGIN_SUCCESS' || type === 'ATTACHMENT_DOWNLOADED') return 'green'
  if (type === 'SESSION_CREATED' || type === 'CONNECT_CLICKED' || type === 'ASSET_CREATED' || type === 'LINK_CREATED' || type === 'KB_CREATED') return 'cyan'
  if (type === 'SESSION_CLOSED' || type === 'ASSET_UPDATED' || type === 'KB_UPDATED' || type === 'SETTING_UPDATED') return 'amber'
  if (type === 'PASSWORD_VIEWED') return 'green'
  if (type === 'DOCUMENT_CREATED') return 'cyan'
  if (type === 'DOCUMENT_APPROVED') return 'green'
  if (type === 'DOCUMENT_REJECTED') return 'red'
  if (type === 'DOCUMENT_DOWNLOADED') return 'green'
  return 'muted'
}

export function AuditPage() {
  const [filterType, setFilterType] = useState<string>('')

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['audit', filterType],
    queryFn: () =>
      auditApi
        .list({ limit: 200, event_type: filterType || undefined })
        .then((r) => r.data),
  })

  const formatMeta = (meta: string | null) => {
    if (!meta) return '—'
    try {
      const obj = JSON.parse(meta)
      return Object.entries(obj)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    } catch {
      return meta
    }
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Auditoría"
        subtitle={`${events.length} eventos registrados`}
        icon={<ShieldAlert size={16} />}
        action={
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-text-muted" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-elevated border border-border rounded px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-cyan/60"
            >
              <option value="">Todos los eventos</option>
              {eventTypes.map((t) => (
                <option key={t} value={t}>
                  {typeLabels[t]}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['ID', 'Evento', 'Usuario', 'Sesión', 'Metadata', 'Fecha'].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-[11px] font-sans font-medium text-text-muted uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => (
              <motion.tr
                key={ev.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="border-b border-border/50 hover:bg-elevated/50 transition-colors"
              >
                <td className="px-5 py-3 font-mono text-xs text-text-muted">#{ev.id}</td>
                <td className="px-5 py-3">
                  <Badge variant={typeBadgeVariant(ev.type)}>{typeLabels[ev.type] || ev.type}</Badge>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-text-secondary">
                  {ev.user_id ? `#${ev.user_id}` : '—'}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-text-secondary">
                  {ev.session_id ? `#${ev.session_id}` : '—'}
                </td>
                <td className="px-5 py-3 font-mono text-[11px] text-text-muted max-w-xs truncate">
                  {formatMeta(ev.metadata_json)}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-text-secondary whitespace-nowrap">
                  {new Date(ev.at).toLocaleString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
              </motion.tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-text-muted">
                  No hay eventos de auditoría registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

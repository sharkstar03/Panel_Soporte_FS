import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Monitor, ClipboardList, CheckCircle2, Clock, AlertTriangle, Activity } from 'lucide-react'
import { assetsApi, sessionsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import type { SupportSession } from '../api/types'

function StatCard({ label, value, icon: Icon, accent, delay = 0 }: {
  label: string; value: number | string; icon: React.ElementType; accent: string; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-panel border border-border rounded-lg p-5 relative overflow-hidden group hover:border-border-bright transition-colors"
    >
      <div className={`absolute top-0 left-0 w-full h-0.5 ${accent}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-text-muted uppercase tracking-wide mb-2">{label}</p>
          <p className="font-display font-bold text-3xl text-text-primary">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent.includes('cyan') ? 'bg-cyan/10 text-cyan' : accent.includes('green') ? 'bg-green-op/10 text-green-op' : accent.includes('amber') ? 'bg-amber-op/10 text-amber-op' : 'bg-red-op/10 text-red-op'}`}>
          <Icon size={18} />
        </div>
      </div>
    </motion.div>
  )
}

function sessionStatusBadge(s: SupportSession) {
  if (s.status === 'closed') {
    if (s.result === 'resuelto') return <Badge variant="green" dot>Resuelto</Badge>
    if (s.result === 'escalado') return <Badge variant="amber" dot>Escalado</Badge>
    if (s.result === 'no_se_pudo_acceder') return <Badge variant="red" dot>Sin acceso</Badge>
    return <Badge variant="muted" dot>Cerrado</Badge>
  }
  if (s.status === 'in_progress') return <Badge variant="cyan" dot>En progreso</Badge>
  return <Badge variant="muted" dot>Creado</Badge>
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data: assets, isLoading: loadingAssets } = useQuery({ queryKey: ['assets'], queryFn: () => assetsApi.list().then(r => r.data) })
  const { data: sessions, isLoading: loadingSessions } = useQuery({ queryKey: ['sessions'], queryFn: () => sessionsApi.list().then(r => r.data) })

  if (loadingAssets || loadingSessions) return <PageLoader />

  const total = sessions?.length ?? 0
  const active = sessions?.filter(s => s.status !== 'closed').length ?? 0
  const resolved = sessions?.filter(s => s.result === 'resuelto').length ?? 0
  const pending = sessions?.filter(s => s.result === 'pendiente' || s.result === 'escalado').length ?? 0
  const recent = sessions?.slice(0, 8) ?? []

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <motion.div className="mb-8" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="font-mono text-xs text-cyan uppercase tracking-wide mb-1">Panel de Control</p>
        <h1 className="font-display font-bold text-2xl text-text-primary">Bienvenido, <span className="text-cyan">{user?.username}</span></h1>
        <p className="font-sans text-sm text-text-secondary mt-1">
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Activos registrados" value={assets?.length ?? 0} icon={Monitor} accent="bg-cyan" delay={0.05} />
        <StatCard label="Sesiones activas" value={active} icon={Activity} accent="bg-cyan" delay={0.1} />
        <StatCard label="Resueltas" value={resolved} icon={CheckCircle2} accent="bg-green-op" delay={0.15} />
        <StatCard label="Pendientes / Escaladas" value={pending} icon={AlertTriangle} accent="bg-amber-op" delay={0.2} />
      </div>

      {/* Recent sessions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-panel border border-border rounded-lg overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ClipboardList size={15} className="text-cyan" />
            <h2 className="font-display font-semibold text-sm text-text-primary tracking-wide">Sesiones Recientes</h2>
          </div>
          <span className="font-mono text-xs text-text-muted">{total} total</span>
        </div>

        {recent.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Clock size={32} className="text-text-muted mx-auto mb-3" />
            <p className="font-sans text-sm text-text-secondary">No hay sesiones registradas aún.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['ID', 'Activo', 'Herramienta', 'Estado', 'Inicio'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-sans font-medium text-text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((s, i) => (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.04 }}
                  className="border-b border-border/50 hover:bg-elevated/50 transition-colors"
                >
                  <td className="px-5 py-3 font-mono text-xs text-text-muted">#{s.id}</td>
                  <td className="px-5 py-3 font-sans text-sm text-text-primary">Activo #{s.asset_id}</td>
                  <td className="px-5 py-3 font-mono text-xs text-cyan uppercase">{s.tool}</td>
                  <td className="px-5 py-3">{sessionStatusBadge(s)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-text-secondary">
                    {new Date(s.start_at).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  )
}

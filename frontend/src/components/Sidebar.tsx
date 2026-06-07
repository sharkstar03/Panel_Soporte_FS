import { NavLink, useNavigate } from 'react-router-dom'
import { Monitor, ClipboardList, BookOpen, Link2, Users, LogOut, LayoutDashboard, ShieldAlert, Settings, KeyRound, FileText, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { motion } from 'framer-motion'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', perm: 'dashboard.view' },
  { to: '/assets', icon: Monitor, label: 'Activos', perm: 'assets.view' },
  { to: '/sessions', icon: ClipboardList, label: 'Sesiones', perm: 'sessions.view' },
  { to: '/documents', icon: FileText, label: 'Documentos', perm: 'documents.view' },
  { to: '/passwords', icon: KeyRound, label: 'Contraseñas', perm: 'passwords.view' },
  { to: '/kb', icon: BookOpen, label: 'Base de Conocimiento', perm: 'kb.view' },
  { to: '/links', icon: Link2, label: 'Links', perm: 'links.view' },
]

const adminItems = [
  { to: '/users', icon: Users, label: 'Usuarios', perm: 'users.manage' },
  { to: '/audit', icon: ShieldAlert, label: 'Auditoría', perm: 'audit.view' },
  { to: '/settings', icon: Settings, label: 'Configuración', perm: 'settings.manage' },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const { user, logout, can } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }
  const showAdmin = adminItems.some(i => can(i.perm))

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 px-3 py-2.5 rounded text-sm font-sans transition-all duration-150 ${
      isActive
        ? 'bg-cyan/10 text-cyan border border-cyan/20 shadow-cyan-glow'
        : 'text-text-secondary hover:text-text-primary hover:bg-elevated border border-transparent'
    }`

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-shrink-0 flex-col border-r border-border bg-panel transition-transform duration-200 ease-out md:sticky md:top-0 md:z-auto md:w-56 md:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-border px-5 py-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <div className="flex items-center gap-2.5">
          <img src="/logo-cyan.png" alt="Q" className="h-8 w-8 object-contain" />
          <div>
            <p className="font-display font-bold text-text-primary text-sm tracking-wide leading-none">QUANTIUM</p>
            <p className="font-mono text-[10px] text-text-muted tracking-wider leading-none mt-0.5">SOPORTE OPS</p>
          </div>
        </div>
        {/* Cerrar (solo móvil) */}
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary md:hidden"
          aria-label="Cerrar menú"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.filter(i => can(i.perm)).map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onClose} className={linkClass}>
            {({ isActive }) => (
              <>
                <Icon size={15} className={isActive ? 'text-cyan' : 'text-text-muted group-hover:text-text-secondary'} />
                <span className="truncate">{label}</span>
                {isActive && (
                  <motion.div layoutId="nav-indicator" className="ml-auto h-1 w-1 rounded-full bg-cyan" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {showAdmin && (
          <>
            <div className="px-3 pb-1 pt-4">
              <p className="text-[11px] font-sans font-medium uppercase tracking-wide text-text-muted">Admin</p>
            </div>
            {adminItems.filter(i => can(i.perm)).map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} onClick={onClose} className={linkClass}>
                {({ isActive }) => (
                  <>
                    <Icon size={15} className={isActive ? 'text-cyan' : 'text-text-muted group-hover:text-text-secondary'} />
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-border px-3 py-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="mb-2 flex items-center gap-3 rounded border border-border bg-elevated px-3 py-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-cyan/30 bg-cyan/20">
            <span className="font-mono text-xs font-bold text-cyan">{user?.username?.[0]?.toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-sans text-xs text-text-primary">{user?.username}</p>
            <p className="text-[11px] font-sans font-medium uppercase tracking-wide text-text-muted">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded border border-transparent px-3 py-2 font-sans text-sm text-text-secondary transition-all duration-150 hover:border-red-op/20 hover:bg-red-op/5 hover:text-red-op"
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

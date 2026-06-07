import { NavLink, useNavigate } from 'react-router-dom'
import { Monitor, ClipboardList, BookOpen, Link2, Users, LogOut, LayoutDashboard, ShieldAlert, Settings, KeyRound, FileText } from 'lucide-react'
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
  { to: '/rbac', icon: ShieldAlert, label: 'Roles y permisos', perm: 'rbac.manage' },
  { to: '/audit', icon: ShieldAlert, label: 'Auditoría', perm: 'audit.view' },
  { to: '/settings', icon: Settings, label: 'Configuración', perm: 'settings.manage' },
]

export function Sidebar() {
  const { user, logout, can } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }
  const showAdmin = adminItems.some(i => can(i.perm))

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-panel border-r border-border h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <img src="/logo-cyan.png" alt="Q" className="w-8 h-8 object-contain" />
          <div>
            <p className="font-display font-bold text-text-primary text-sm tracking-wide leading-none">QUANTIUM</p>
            <p className="font-mono text-[10px] text-text-muted tracking-wider leading-none mt-0.5">SOPORTE OPS</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.filter(i => can(i.perm)).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded text-sm font-sans transition-all duration-150 ${
                isActive
                  ? 'bg-cyan/10 text-cyan border border-cyan/20 shadow-cyan-glow'
                  : 'text-text-secondary hover:text-text-primary hover:bg-elevated border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={15} className={isActive ? 'text-cyan' : 'text-text-muted group-hover:text-text-secondary'} />
                <span className="truncate">{label}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="ml-auto w-1 h-1 rounded-full bg-cyan"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}

        {showAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-[11px] font-sans font-medium text-text-muted uppercase tracking-wide">Admin</p>
            </div>
            {adminItems.filter(i => can(i.perm)).map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded text-sm font-sans transition-all duration-150 ${
                    isActive
                      ? 'bg-cyan/10 text-cyan border border-cyan/20 shadow-cyan-glow'
                      : 'text-text-secondary hover:text-text-primary hover:bg-elevated border border-transparent'
                  }`
                }
              >
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
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded bg-elevated border border-border mb-2">
          <div className="w-7 h-7 rounded bg-cyan/20 border border-cyan/30 flex items-center justify-center flex-shrink-0">
            <span className="font-mono text-xs font-bold text-cyan">{user?.username?.[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-sans text-text-primary truncate">{user?.username}</p>
            <p className="text-[11px] font-sans font-medium text-text-muted uppercase tracking-wide">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-sans text-text-secondary hover:text-red-op hover:bg-red-op/5 border border-transparent hover:border-red-op/20 transition-all duration-150"
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

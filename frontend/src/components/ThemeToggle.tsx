import { Sun, Moon } from 'lucide-react'
import { getTheme, type Theme } from '../theme'
import { useAuth } from '../context/AuthContext'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { user, setUserTheme } = useAuth()
  const theme: Theme = user?.theme ?? getTheme()
  const isLight = theme === 'light'

  const toggle = () => {
    const next: Theme = isLight ? 'dark' : 'light'
    setUserTheme(next)
  }

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={isLight}
      title={isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors ${
        isLight ? 'bg-cyan/20 border-cyan/40' : 'bg-elevated border-border'
      } ${className}`}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-panel shadow transform transition-transform duration-200 ${
          isLight ? 'translate-x-6' : 'translate-x-1'
        }`}
      >
        {isLight ? <Sun size={11} className="text-amber-op" /> : <Moon size={11} className="text-cyan" />}
      </span>
    </button>
  )
}

import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'

export function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Cerrar el cajón al navegar (en móvil).
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  // Bloquear el scroll del fondo cuando el cajón está abierto.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <div className="flex h-screen bg-base text-text-primary overflow-hidden">
      {/* Background grid */}
      <div className="fixed inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none" />

      {/* Backdrop (solo móvil, cuando el cajón está abierto) */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          aria-hidden="true"
        />
      )}

      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Barra superior (solo móvil) */}
        <header className="flex items-center border-b border-border bg-panel/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
          <div className="flex h-14 w-full items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="-ml-1 flex h-10 w-10 items-center justify-center rounded text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <img src="/logo-fs.png" alt="Farmacia Saba" className="h-10 w-10 object-contain" />
              <span className="font-display text-sm font-bold tracking-wide">FARMACIA SABA</span>
            </div>
            <ThemeToggle className="ml-auto" />
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-4 pb-[env(safe-area-inset-bottom)] sm:px-6 sm:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

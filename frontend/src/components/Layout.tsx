import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="flex h-screen bg-base text-text-primary overflow-hidden">
      {/* Background grid */}
      <div className="fixed inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none" />

      <Sidebar />

      <main className="flex-1 overflow-y-auto relative">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

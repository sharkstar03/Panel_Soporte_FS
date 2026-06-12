import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import './index.css'
import { applyTheme, getTheme } from './theme'

// Aplica el tema guardado en cuanto arranca la app (además del script inline en
// index.html). Garantiza que el tema visible siempre coincida con la preferencia
// guardada, aunque el navegador sirva un index.html cacheado sin el script.
applyTheme(getTheme())

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

// Registrar el Service Worker (PWA) solo en producción para no interferir
// con el hot-reload del servidor de desarrollo.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <App />
          <Toaster position="bottom-right" toastOptions={{
            style: { background: '#0d1422', color: '#e2eaf4', border: '1px solid #1a2a40', fontFamily: 'IBM Plex Sans', fontSize: '13px' },
            success: { iconTheme: { primary: '#00e676', secondary: '#0d1422' } },
            error: { iconTheme: { primary: '#ff4757', secondary: '#0d1422' } },
          }} />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
)

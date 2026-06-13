import { useState, FormEvent, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api/client'

type CheckStatus = 'checking' | 'ok' | 'fail'

interface HealthChecks {
  backend: CheckStatus
  db: CheckStatus
  dgi: CheckStatus
}

export function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [termLine, setTermLine] = useState(0)
  const [checks, setChecks] = useState<HealthChecks>({ backend: 'checking', db: 'checking', dgi: 'checking' })

  const checking = checks.backend === 'checking' || checks.db === 'checking' || checks.dgi === 'checking'
  const ready = checks.backend === 'ok' && checks.db === 'ok' && checks.dgi === 'ok'

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    api
      .get('/health')
      .then((r) => {
        const data = r.data || {}
        setChecks({
          backend: 'ok',
          db: data.db ? 'ok' : 'fail',
          dgi: data.dgi ? 'ok' : 'fail',
        })
      })
      .catch(() => {
        setChecks({ backend: 'fail', db: 'fail', dgi: 'fail' })
      })
  }, [])

  const lineState = (s: CheckStatus, okText: string, failText: string, pendingText: string) =>
    s === 'checking' ? pendingText : s === 'ok' ? okText : failText

  const LINES = [
    '> Inicializando sistema de soporte...',
    lineState(checks.backend, '> Backend: conexión establecida.', '> Backend: ERROR de conexión.', '> Verificando conexión con el backend...'),
    lineState(checks.db, '> Base de datos: conexión OK.', '> Base de datos: ERROR de conexión.', '> Verificando base de datos...'),
    lineState(checks.dgi, '> DGI / PlaceFT: conexión OK.', '> DGI / PlaceFT: ERROR de conexión.', '> Verificando conexión con la DGI...'),
    ready ? '> Sistema listo. Acceso habilitado.' : '> Sistema con errores. Acceso deshabilitado.',
  ]

  useEffect(() => {
    if (termLine >= LINES.length) return
    // Pausa tras la línea 1 hasta tener el resultado real de /health
    if (termLine >= 1 && termLine < LINES.length - 1 && checking) return
    const t = setTimeout(() => setTermLine((l) => l + 1), 600 + termLine * 200)
    return () => clearTimeout(t)
  }, [termLine, checking, LINES.length])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      setLoading(false)
      setSuccess(true)
      setTimeout(() => navigate('/', { replace: true }), 900)
    } catch {
      setError('Credenciales inválidas. Verifica usuario y contraseña.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4 relative overflow-hidden">
      {/* Grid bg */}
      <div className="fixed inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none" />

      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-64 h-64 border-l-2 border-t-2 border-cyan/10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 border-r-2 border-b-2 border-cyan/10 pointer-events-none" />

      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan/5 rounded-full blur-3xl pointer-events-none" />

      {/* Success flash */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-green-op/10 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-lg bg-cyan/10 border border-cyan/30 shadow-cyan-glow mb-4 relative">
            <img src="/logo-fs.png" alt="Farmacia Saba" className="w-16 h-16 object-contain" />
            <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-pulse shadow-cyan-glow ${ready ? 'bg-green-op' : checking ? 'bg-cyan' : 'bg-red-op'}`} />
          </div>
          <h1 className="font-display font-bold text-2xl text-text-primary tracking-wide">FARMACIA SABA</h1>
          <p className="font-mono text-xs text-text-muted tracking-wider mt-1">PANEL SOPORTE v1.0</p>
        </div>

        {/* Terminal lines */}
        <div className="mb-6 bg-base/80 border border-border rounded px-4 py-3 font-mono text-xs text-green-op min-h-[110px]">
          {LINES.slice(0, termLine).map((line, i) => {
            const isLast = i === termLine - 1
            const checkForLine = i === 1 ? checks.backend : i === 2 ? checks.db : i === 3 ? checks.dgi : null
            const isError = (checkForLine === 'fail') || (i === LINES.length - 1 && !ready)
            return (
              <motion.p
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={isError ? 'text-red-op' : isLast ? 'text-cyan' : 'text-green-op/60'}
              >
                {line}
              </motion.p>
            )
          })}
          {termLine < LINES.length && (
            <span className="inline-block w-2 h-3.5 bg-cyan animate-pulse ml-0.5" />
          )}
        </div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="bg-panel border border-border rounded-lg p-6 space-y-4 shadow-2xl shadow-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="space-y-1.5">
            <label className="block text-[11px] font-sans font-medium text-text-muted uppercase tracking-wide">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              autoFocus
              disabled={!ready || loading || success}
              className="w-full bg-elevated border border-border rounded px-3 py-2.5 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-cyan/60 focus:ring-1 focus:ring-cyan/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-sans font-medium text-text-muted uppercase tracking-wide">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={!ready || loading || success}
              className="w-full bg-elevated border border-border rounded px-3 py-2.5 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-cyan/60 focus:ring-1 focus:ring-cyan/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-[11px] text-text-muted hover:text-cyan transition-colors">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-op bg-red-op/10 border border-red-op/20 rounded px-3 py-2"
            >
              {error}
            </motion.p>
          )}

          {!ready && !checking && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-amber-op bg-amber-op/10 border border-amber-op/20 rounded px-3 py-2"
            >
              No se puede iniciar sesión: hay servicios sin conexión. Contacte a soporte.
            </motion.p>
          )}

          <motion.button
            type="submit"
            disabled={!ready || loading || success}
            whileTap={!loading && !success ? { scale: 0.97 } : {}}
            className={`w-full font-display font-semibold py-2.5 rounded tracking-wide transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              success
                ? 'bg-green-op text-base shadow-cyan-glow-lg'
                : 'bg-cyan text-base hover:bg-cyan/80 shadow-cyan-glow hover:shadow-cyan-glow-lg disabled:opacity-50'
            }`}
          >
            <AnimatePresence mode="wait">
              {success ? (
                <motion.span
                  key="success"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <motion.svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      d="M4 12l5 5L20 6"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                  </motion.svg>
                  ACCESO CONCEDIDO
                </motion.span>
              ) : loading ? (
                <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AUTENTICANDO...
                </motion.span>
              ) : !ready ? (
                <motion.span key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  VERIFICANDO SISTEMA...
                </motion.span>
              ) : (
                <motion.span key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  ACCEDER AL SISTEMA
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.form>
      </motion.div>
    </div>
  )
}

import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { motion } from 'framer-motion'

const LINES = [
  '> Inicializando sistema de soporte...',
  '> Conectando a base de datos...',
  '> Módulo de auditoría activo.',
  '> Sistema listo.',
]

export function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [termLine, setTermLine] = useState(0)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    if (termLine >= LINES.length) return
    const t = setTimeout(() => setTermLine((l) => l + 1), 600 + termLine * 200)
    return () => clearTimeout(t)
  }, [termLine])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch {
      setError('Credenciales inválidas. Verifica usuario y contraseña.')
    } finally {
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
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan animate-pulse shadow-cyan-glow" />
          </div>
          <h1 className="font-display font-bold text-2xl text-text-primary tracking-wide">FARMACIA SABA</h1>
          <p className="font-mono text-xs text-text-muted tracking-wider mt-1">PANEL SOPORTE v1.0</p>
        </div>

        {/* Terminal lines */}
        <div className="mb-6 bg-base/80 border border-border rounded px-4 py-3 font-mono text-xs text-green-op min-h-[80px]">
          {LINES.slice(0, termLine).map((line, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={i === termLine - 1 ? 'text-cyan' : 'text-green-op/60'}
            >
              {line}
            </motion.p>
          ))}
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
              className="w-full bg-elevated border border-border rounded px-3 py-2.5 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-cyan/60 focus:ring-1 focus:ring-cyan/20 transition-colors"
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
              className="w-full bg-elevated border border-border rounded px-3 py-2.5 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-cyan/60 focus:ring-1 focus:ring-cyan/20 transition-colors"
            />
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan text-base font-display font-semibold py-2.5 rounded tracking-wide hover:bg-cyan/80 shadow-cyan-glow hover:shadow-cyan-glow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                AUTENTICANDO...
              </>
            ) : 'ACCEDER AL SISTEMA'}
          </button>
        </motion.form>
      </motion.div>
    </div>
  )
}

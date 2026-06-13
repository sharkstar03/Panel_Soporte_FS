import { useState, FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowLeft } from 'lucide-react'
import { authApi } from '../api/client'
import { Button } from '../components/ui/Button'
import { Input, FormField } from '../components/ui/Input'

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (!token) return
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo restablecer la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none" />

      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-lg bg-cyan/10 border border-cyan/30 shadow-cyan-glow mb-4">
            <img src="/logo-fs.png" alt="Farmacia Saba" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="font-display font-bold text-2xl text-text-primary tracking-wide">FARMACIA SABA</h1>
          <p className="font-mono text-xs text-text-muted tracking-wider mt-1">NUEVA CONTRASEÑA</p>
        </div>

        <div className="bg-panel border border-border rounded-lg p-6 space-y-4 shadow-2xl shadow-black/50">
          {done ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
              <CheckCircle2 size={40} className="mx-auto mb-3 text-green-400" />
              <p className="text-text-primary font-semibold mb-1">Contraseña actualizada</p>
              <p className="text-text-muted text-sm">Redirigiendo a inicio de sesión...</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-text-secondary text-sm">Ingresa tu nueva contraseña.</p>

              <FormField label="Nueva contraseña">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus
                  minLength={10}
                />
              </FormField>

              <FormField label="Confirmar contraseña">
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={10}
                />
              </FormField>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-op bg-red-op/10 border border-red-op/20 rounded px-3 py-2"
                >
                  {error}
                </motion.p>
              )}

              <Button type="submit" loading={loading} className="w-full">
                Restablecer contraseña
              </Button>
            </form>
          )}

          <Link to="/login" className="flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-cyan transition-colors pt-2">
            <ArrowLeft size={12} /> Volver a iniciar sesión
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

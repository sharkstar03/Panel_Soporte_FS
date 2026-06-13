import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MailCheck, ArrowLeft } from 'lucide-react'
import { authApi } from '../api/client'
import { Button } from '../components/ui/Button'
import { Input, FormField } from '../components/ui/Input'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email.trim().toLowerCase())
      setSent(true)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al procesar la solicitud')
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
          <p className="font-mono text-xs text-text-muted tracking-wider mt-1">RECUPERAR CONTRASEÑA</p>
        </div>

        <div className="bg-panel border border-border rounded-lg p-6 space-y-4 shadow-2xl shadow-black/50">
          {sent ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
              <MailCheck size={40} className="mx-auto mb-3 text-cyan" />
              <p className="text-text-primary font-semibold mb-1">Revisa tu correo</p>
              <p className="text-text-muted text-sm">Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-text-secondary text-sm">
                Ingresa el correo asociado a tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <FormField label="Correo electrónico">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                  required
                  autoFocus
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
                Enviar enlace de recuperación
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

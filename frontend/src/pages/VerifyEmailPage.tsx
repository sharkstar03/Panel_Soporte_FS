import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { authApi } from '../api/client'

export function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    authApi.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((e) => {
        setError(e?.response?.data?.detail || 'No se pudo verificar el correo')
        setStatus('error')
      })
  }, [token])

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-md bg-panel border border-border rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="bg-elevated/40 px-6 py-4 border-b border-border flex items-center justify-between">
          <span className="font-bold text-cyan text-sm tracking-wide">FARMACIA SABA</span>
          <span className="text-text-muted text-xs font-mono">Verificación de Correo</span>
        </div>

        <div className="p-10 text-center">
          {status === 'loading' && (
            <>
              <Loader2 size={40} className="mx-auto mb-4 text-cyan animate-spin" />
              <p className="text-text-secondary text-sm">Verificando tu correo...</p>
            </>
          )}

          {status === 'success' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
              <CheckCircle2 size={56} className="mx-auto mb-4 text-green-400" />
              <p className="text-green-400 font-bold text-xl mb-1">Correo verificado</p>
              <p className="text-text-secondary text-sm mb-6">Tu dirección de correo ha sido confirmada correctamente.</p>
              <Link to="/profile" className="text-cyan text-sm underline">Volver a mi perfil</Link>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
              <XCircle size={56} className="mx-auto mb-4 text-red-400" />
              <p className="text-red-400 font-bold text-xl mb-1">No se pudo verificar</p>
              <p className="text-text-secondary text-sm mb-6">{error}</p>
              <Link to="/profile" className="text-cyan text-sm underline">Volver a mi perfil</Link>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

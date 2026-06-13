import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Camera, User as UserIcon, Palette, MailCheck, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Avatar } from '../components/Avatar'
import { Button } from '../components/ui/Button'
import { Input, FormField, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [birthday, setBirthday] = useState(user?.birthday ?? '')

  const saveMutation = useMutation({
    mutationFn: () =>
      authApi.updateProfile({
        display_name: displayName.trim() || null,
        email: email.trim() || null,
        birthday: birthday || null,
      }),
    onSuccess: (r) => {
      setUser(r.data)
      toast.success('Perfil actualizado')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Error al guardar el perfil'),
  })

  const avatarMutation = useMutation({
    mutationFn: (file: File) => authApi.uploadAvatar(file),
    onSuccess: (r) => {
      setUser(r.data)
      toast.success('Foto de perfil actualizada')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Error al subir la imagen'),
  })

  const verifyMutation = useMutation({
    mutationFn: () => authApi.sendEmailVerification(),
    onSuccess: (r) => toast.success(r.data?.detail || 'Correo de verificación enviado'),
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Error al enviar el correo de verificación'),
  })

  const themeMutation = useMutation({
    mutationFn: (theme: 'dark' | 'light') => authApi.updateProfile({ theme }),
    onSuccess: (r) => {
      setUser(r.data)
      toast.success('Tema actualizado')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Error al cambiar el tema'),
  })

  const twoFactorMutation = useMutation({
    mutationFn: (two_factor_enabled: boolean) => authApi.updateProfile({ two_factor_enabled }),
    onSuccess: (r) => {
      setUser(r.data)
      toast.success(r.data.two_factor_enabled ? 'Verificación en dos pasos activada' : 'Verificación en dos pasos desactivada')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Error al cambiar la verificación en dos pasos'),
  })

  if (!user) return null

  const handleAvatarClick = () => fileInputRef.current?.click()
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) avatarMutation.mutate(file)
    e.target.value = ''
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Mi Perfil" subtitle="Personaliza tu cuenta y preferencias" icon={<UserIcon size={18} />} />

      <div className="bg-panel border border-border rounded-lg p-6 space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleAvatarClick}
            className="relative group"
            title="Cambiar foto de perfil"
          >
            <Avatar userId={user.id} avatarKey={user.avatar_key} name={user.display_name || user.username} size={72} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-base/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={20} className="text-cyan" />
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <div>
            <p className="font-display font-semibold text-text-primary">{user.display_name || user.username}</p>
            <p className="font-mono text-xs text-text-muted uppercase tracking-wide">{user.role}</p>
          </div>
        </div>

        {/* Form */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nombre para mostrar">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={user.username}
            />
          </FormField>

          <FormField label="Usuario">
            <Input value={user.username} disabled className="opacity-60" />
          </FormField>

          <FormField label="Correo electrónico">
            <div className="space-y-1.5">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@empresa.com"
              />
              {user.email && (
                <div className="flex items-center gap-2">
                  <Badge variant={user.email_verified ? 'green' : 'amber'} dot>
                    {user.email_verified ? 'Verificado' : 'No verificado'}
                  </Badge>
                  {!user.email_verified && (
                    <button
                      type="button"
                      onClick={() => verifyMutation.mutate()}
                      disabled={verifyMutation.isPending}
                      className="inline-flex items-center gap-1 text-xs text-cyan hover:underline disabled:opacity-50"
                    >
                      <MailCheck size={12} />
                      {verifyMutation.isPending ? 'Enviando...' : 'Verificar correo'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </FormField>

          <FormField label="Fecha de cumpleaños">
            <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </FormField>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            Guardar cambios
          </Button>
        </div>
      </div>

      {/* Apariencia */}
      <div className="bg-panel border border-border rounded-lg p-6 mt-6 space-y-4">
        <div className="flex items-center gap-2 text-text-primary font-display font-semibold">
          <Palette size={16} className="text-cyan" />
          Apariencia
        </div>
        <FormField label="Tema">
          <Select
            value={user.theme}
            onChange={(e) => themeMutation.mutate(e.target.value as 'dark' | 'light')}
            className="max-w-xs"
          >
            <option value="dark">Oscuro</option>
            <option value="light">Claro</option>
          </Select>
        </FormField>
      </div>

      {/* Seguridad */}
      <div className="bg-panel border border-border rounded-lg p-6 mt-6 space-y-4">
        <div className="flex items-center gap-2 text-text-primary font-display font-semibold">
          <ShieldCheck size={16} className="text-cyan" />
          Seguridad
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-text-primary">Verificación en dos pasos por correo</p>
            <p className="text-xs text-text-muted mt-0.5">
              {user.email_verified
                ? 'Al iniciar sesión, te enviaremos un código de un solo uso a tu correo.'
                : 'Debes verificar tu correo electrónico antes de activar esta opción.'}
            </p>
          </div>
          <button
            onClick={() => twoFactorMutation.mutate(!user.two_factor_enabled)}
            disabled={twoFactorMutation.isPending || (!user.email_verified && !user.two_factor_enabled)}
            role="switch"
            aria-checked={user.two_factor_enabled}
            title={user.two_factor_enabled ? 'Desactivar verificación en dos pasos' : 'Activar verificación en dos pasos'}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              user.two_factor_enabled ? 'bg-cyan/20 border-cyan/40' : 'bg-elevated border-border'
            }`}
          >
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-panel shadow transform transition-transform duration-200 ${
                user.two_factor_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}

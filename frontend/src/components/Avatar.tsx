import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

interface Props {
  userId: number
  avatarKey: string | null
  name?: string | null
  size?: number
  className?: string
}

export function Avatar({ userId, avatarKey, name, size = 32, className = '' }: Props) {
  const { data: src } = useQuery({
    queryKey: ['avatar', userId, avatarKey],
    queryFn: () =>
      api.get(`/auth/avatar/${userId}`, { responseType: 'blob' }).then((r) => URL.createObjectURL(r.data)),
    enabled: !!avatarKey,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const initial = (name?.trim()?.[0] || '?').toUpperCase()

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover border border-cyan/30 ${className}`}
      />
    )
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`flex items-center justify-center rounded-full border border-cyan/30 bg-cyan/20 font-mono font-bold text-cyan ${className}`}
    >
      {initial}
    </div>
  )
}

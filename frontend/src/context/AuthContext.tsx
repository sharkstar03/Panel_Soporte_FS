import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authApi } from '../api/client'
import type { User } from '../api/types'

interface AuthCtx {
  user: User | null
  token: string | null
  loading: boolean
  can: (permission: string) => boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(!!localStorage.getItem('token'))

  useEffect(() => {
    if (!token) { setLoading(false); return }
    authApi.me()
      .then((r) => setUser(r.data))
      .catch(() => { localStorage.removeItem('token'); setToken(null) })
      .finally(() => setLoading(false))
  }, [token])

  const login = async (username: string, password: string) => {
    const r = await authApi.login(username, password)
    const t = r.data.access_token
    localStorage.setItem('token', t)
    setToken(t)
    const me = await authApi.me()
    setUser(me.data)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const can = (permission: string) => {
    if (!user) return false
    if (user.role === 'admin') return true
    return user.permissions?.includes(permission) ?? false
  }

  return <Ctx.Provider value={{ user, token, loading, can, login, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

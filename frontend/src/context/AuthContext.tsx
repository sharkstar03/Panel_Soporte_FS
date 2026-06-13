import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authApi } from '../api/client'
import type { User } from '../api/types'
import { setTheme as applyAndStoreTheme, type Theme } from '../theme'

interface LoginResult {
  twoFactorRequired: boolean
  pendingToken?: string
}

interface AuthCtx {
  user: User | null
  token: string | null
  loading: boolean
  can: (permission: string) => boolean
  login: (username: string, password: string) => Promise<LoginResult>
  verifyOtp: (pendingToken: string, code: string) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
  setUserTheme: (theme: Theme) => void
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(!!localStorage.getItem('token'))

  useEffect(() => {
    if (!token) { setLoading(false); return }
    authApi.me()
      .then((r) => {
        setUser(r.data)
        applyAndStoreTheme(r.data.theme)
      })
      .catch(() => { localStorage.removeItem('token'); setToken(null) })
      .finally(() => setLoading(false))
  }, [token])

  const completeLogin = async (accessToken: string) => {
    localStorage.setItem('token', accessToken)
    setToken(accessToken)
    const me = await authApi.me()
    setUser(me.data)
    applyAndStoreTheme(me.data.theme)
  }

  const login = async (username: string, password: string): Promise<LoginResult> => {
    const r = await authApi.login(username, password)
    if (r.data.two_factor_required) {
      return { twoFactorRequired: true, pendingToken: r.data.pending_token ?? undefined }
    }
    await completeLogin(r.data.access_token!)
    return { twoFactorRequired: false }
  }

  const verifyOtp = async (pendingToken: string, code: string) => {
    const r = await authApi.verifyOtp(pendingToken, code)
    await completeLogin(r.data.access_token!)
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

  const setUserTheme = (theme: Theme) => {
    applyAndStoreTheme(theme)
    if (!user) return
    setUser({ ...user, theme })
    authApi.updateProfile({ theme }).catch(() => { /* preferencia local sigue aplicada */ })
  }

  return <Ctx.Provider value={{ user, token, loading, can, login, verifyOtp, logout, setUser, setUserTheme }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

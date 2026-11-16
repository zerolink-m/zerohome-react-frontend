import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import * as authStore from '../api/authStore'
import * as authApi from '../api/auth'
import { getMe } from '../api/users'
import { loadProfileSnapshot, saveProfileSnapshot } from '../api/snapshots'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [state, setState] = useState(authStore.getState)
  const [profile, setProfile] = useState(() => loadProfileSnapshot(authStore.getState().uid))
  useEffect(() => authStore.subscribe(setState), [])

  const refreshProfile = useCallback(async () => {
    const token = authStore.getAccessToken()
    if (!token) return null
    try {
      const me = await getMe()
      if (!me || authStore.getAccessToken() !== token) return null
      authStore.setIdentity({ uid: me.id, role: me.role, email: me.email }, token)
      setProfile(me)
      saveProfileSnapshot(me.id, me)
      return me
    } catch {
      // Сетевой сбой не удаляет сессию. Повторим при возвращении online/фокуса.
      return null
    }
  }, [])

  useEffect(() => {
    const currentUid = state.uid
    setProfile(p => p?.id === currentUid ? p : loadProfileSnapshot(currentUid))
    if (state.accessToken) refreshProfile()
    else if (!state.isAuthenticated) setProfile(null)
  }, [state.accessToken, state.uid, state.isAuthenticated, refreshProfile])

  useEffect(() => {
    if (authStore.getLegacyToken() && !authStore.getAccessToken()) {
      authApi.exchangeAccess().then(() => refreshProfile()).catch(() => {})
    }
  }, [refreshProfile])

  useEffect(() => {
    const retry = () => {
      if (authStore.getAccessToken() && authStore.getState().uid == null) refreshProfile()
      if (authStore.getLegacyToken() && !authStore.getAccessToken()) authApi.exchangeAccess().catch(() => {})
    }
    window.addEventListener('online', retry)
    window.addEventListener('focus', retry)
    return () => { window.removeEventListener('online', retry); window.removeEventListener('focus', retry) }
  }, [refreshProfile])

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password })
    authStore.setBearer(data.token, { email: email.trim().toLowerCase() })
    return refreshProfile() // при временной сетевой ошибке bearer остаётся сохранённым
  }, [refreshProfile])

  const register = useCallback(async (fields) => {
    const data = await authApi.register(fields)
    authStore.setBearer(data.token, { uid: data.user?.id, email: fields.email.trim().toLowerCase() })
    await refreshProfile()
    return data
  }, [refreshProfile])

  const logout = useCallback(async () => {
    const token = authStore.getAccessToken()
    try { if (token) await authApi.logout() } catch { /* локальный выход даже при недоступном сервере */ }
    authStore.clear(token)
  }, [])

  return <AuthContext.Provider value={{ ...state, initializing: false, profile, refreshProfile, login, register, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return ctx
}

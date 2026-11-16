import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getConfig } from '../api/config'
import { CODES } from '../api/codes'
import { startHostMonitor } from '../api/webrtcCheck'

const HealthContext = createContext(null)

const POLL_INTERVAL_MS = 60_000

export function HealthProvider({ children }) {
  const [state, setState] = useState({
    online: null,
    version: null,
    checking: false,
    lastCheckedAt: null,
    updateAvailable: false,
    updateRequired: false,
    serverVersion: null,
  })
  const timerRef = useRef(null)

  const checkNow = useCallback(async () => {
    setState((s) => ({ ...s, checking: true }))
    try {
      const { code, version, actualVersion } = await getConfig()
      const now = Date.now()
      if (code === CODES.FRONTEND_UPDATE_NEEDED) {
        setState((s) => ({
          ...s,
          online: true,
          version: null,
          checking: false,
          lastCheckedAt: now,
          updateAvailable: false,
          updateRequired: true,
          serverVersion: s.serverVersion,
        }))
      } else if (code === CODES.FRONTEND_UPDATE_AVAILABLE) {
        setState({
          online: true,
          version,
          checking: false,
          lastCheckedAt: now,
          updateAvailable: true,
          updateRequired: false,
          serverVersion: actualVersion,
        })
      } else {
        // код 000
        setState({
          online: true,
          version,
          checking: false,
          lastCheckedAt: now,
          updateAvailable: false,
          updateRequired: false,
          serverVersion: null,
        })
      }
    } catch {
      setState((s) => ({ ...s, online: false, checking: false, lastCheckedAt: Date.now() }))
    }
  }, [])

  useEffect(() => {
    startHostMonitor()
    checkNow()
    timerRef.current = setInterval(checkNow, POLL_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [checkNow])

  const value = { ...state, checkNow }

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>
}

export function useBackendHealth() {
  const ctx = useContext(HealthContext)
  if (!ctx) throw new Error('useBackendHealth должен использоваться внутри HealthProvider')
  return ctx
}

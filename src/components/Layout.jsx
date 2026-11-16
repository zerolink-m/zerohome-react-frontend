import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import FooterVersion from './FooterVersion'
import { useBackendHealth } from '../context/HealthContext'
import { useCompactNavbar } from '../hooks/useCompactNavbar'
import { colors } from '../styles/tokens'

const FRONTEND_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'
const DISMISS_KEY = `zc-update-dismissed-for-${FRONTEND_VERSION}`

function reloadApp() {
  // При новом бандле SW уже установит новую версию (skipWaiting в install).
  // Простой reload заберёт свежий index.html + assets.
  window.location.reload()
}

const bannerBase = {
  borderRadius: 12,
  padding: '10px 16px',
  fontSize: 12,
  marginBottom: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
}

const bannerBtn = {
  border: '1px solid currentColor',
  background: 'transparent',
  color: 'inherit',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: '0.04em',
  cursor: 'pointer',
}

export default function Layout() {
  useCompactNavbar()
  const { online, updateAvailable, updateRequired, serverVersion } = useBackendHealth()

  const [dismissedFor, setDismissedFor] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY)
    } catch {
      return null
    }
  })

  // Если сервер отдал новую версию, отличную от той, что скрыл пользователь —
  // покажем баннер заново.
  useEffect(() => {
    if (serverVersion && dismissedFor && dismissedFor !== serverVersion) {
      setDismissedFor(null)
    }
  }, [serverVersion, dismissedFor])

  function dismissUpdate() {
    try {
      if (serverVersion) localStorage.setItem(DISMISS_KEY, serverVersion)
    } catch {
      // localStorage может быть недоступен (privacy mode) — просто скрываем в памяти
    }
    setDismissedFor(serverVersion || 'dismissed')
  }

  const showAvailableBanner =
    updateAvailable && !updateRequired && serverVersion && dismissedFor !== serverVersion

  // Обязательное обновление — полностью блокируем доступ к приложению.
  if (updateRequired) {
    return (
      <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <Navbar />
        <main className="app-main">
          <div
            style={{
              ...bannerBase,
              background: colors.statuses.red.bg,
              border: `1px solid ${colors.statuses.red.border}`,
              color: colors.statuses.red.text,
            }}
          >
            <span style={{ flex: 1 }}>Требуется обновить приложение до последней версии.</span>
            <button style={bannerBtn} onClick={reloadApp}>
              Обновить
            </button>
          </div>
          <div
            style={{
              fontSize: 12,
              color: colors.white[4],
              marginTop: 12,
              lineHeight: 1.6,
            }}
          >
            Текущая версия клиента больше не поддерживается сервером. Нажмите «Обновить», чтобы
            загрузить свежую сборку. Если после обновления страница по-прежнему просит обновиться —
            попробуйте очистить кэш браузера.
          </div>
        </main>
        <FooterVersion />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Navbar />
      <main className="app-main">
        {online === false && (
          <div
            style={{
              ...bannerBase,
              background: colors.statuses.red.bg,
              border: `1px solid ${colors.statuses.red.border}`,
              color: colors.statuses.red.text,
            }}
          >
            Нет связи с сервером. Повторная попытка автоматически...
          </div>
        )}
        {showAvailableBanner && (
          <div
            style={{
              ...bannerBase,
              background: colors.statuses.blue.bg,
              border: `1px solid ${colors.statuses.blue.border}`,
              color: colors.statuses.blue.text,
            }}
          >
            <span style={{ flex: 1 }}>Доступно обновление до {serverVersion}.</span>
            <button style={bannerBtn} onClick={reloadApp}>
              Обновить
            </button>
            <button style={bannerBtn} onClick={dismissUpdate}>
              Скрыть
            </button>
          </div>
        )}
        <Outlet />
      </main>
      <FooterVersion />
    </div>
  )
}

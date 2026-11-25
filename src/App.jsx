import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { matchPath, Routes, Route, useLocation } from 'react-router'
import { timedImport, tlog } from './utils/timingsLog'
import { orbTR, orbBL } from './styles/tokens'
import ToastContainer from './components/ToastContainer'
import ProtectedRoute from './components/ProtectedRoute'
import PublicOnlyRoute from './components/PublicOnlyRoute'
import Layout from './components/Layout'
import AccessGate from './components/AccessGate'
import Spinner from './components/Spinner'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import NotFoundPage from './pages/NotFoundPage'
import RouteErrorBoundary from './components/RouteErrorBoundary'

// Ленивая загрузка тяжёлых страниц: редакторы, админка, плееры
const CamCreatePage = lazy(timedImport('CamCreatePage', () => import('./pages/CamCreatePage')))
const CamDetailPage = lazy(timedImport('CamDetailPage', () => import('./pages/CamDetailPage')))
const CamRecordingsPage = lazy(timedImport('CamRecordingsPage', () => import('./pages/CamRecordingsPage')))
const CamLiveViewPage = lazy(timedImport('CamLiveViewPage', () => import('./pages/CamLiveViewPage')))
const CamMultiViewPage = lazy(timedImport('CamMultiViewPage', () => import('./pages/CamMultiViewPage')))
const SwitchCreatePage = lazy(timedImport('SwitchCreatePage', () => import('./pages/SwitchCreatePage')))
const SwitchDetailPage = lazy(timedImport('SwitchDetailPage', () => import('./pages/SwitchDetailPage')))
const ConnectionCreatePage = lazy(timedImport('ConnectionCreatePage', () => import('./pages/ConnectionCreatePage')))
const ConnectionDetailPage = lazy(timedImport('ConnectionDetailPage', () => import('./pages/ConnectionDetailPage')))
const SharedStreamPage = lazy(timedImport('SharedStreamPage', () => import('./pages/SharedStreamPage')))
const SharedRecordingPage = lazy(timedImport('SharedRecordingPage', () => import('./pages/SharedRecordingPage')))
const SharedSwitchPage = lazy(timedImport('SharedSwitchPage', () => import('./pages/SharedSwitchPage')))
const AccountPage = lazy(timedImport('AccountPage', () => import('./pages/AccountPage')))
const SetupPage = lazy(timedImport('SetupPage', () => import('./pages/SetupPage')))
const AdminPage = lazy(timedImport('AdminPage', () => import('./pages/AdminPage')))
const AdminUsersPage = lazy(timedImport('AdminUsersPage', () => import('./pages/AdminUsersPage')))
const AdminUserSessionsPage = lazy(timedImport('AdminUserSessionsPage', () => import('./pages/AdminUserSessionsPage')))
const StatsPage = lazy(timedImport('StatsPage', () => import('./pages/StatsPage')))
const AdminSystemSettingsPage = lazy(timedImport('AdminSystemSettingsPage', () => import('./pages/AdminSystemSettingsPage')))
const AdminNodesPage = lazy(timedImport('AdminNodesPage', () => import('./pages/AdminNodesPage')))
const AdminClusterPage = lazy(timedImport('AdminClusterPage', () => import('./pages/AdminClusterPage')))

function RouteFallback() {
  return <Spinner style={{ padding: 24 }} />
}

const ROUTE_TITLES = {
  '/': 'Устройства',
  '/login': 'Вход',
  '/register': 'Регистрация',
  '/share/stream/:camId': 'Общий поток',
  '/share/record/:camId': 'Общая запись',
  '/share/switch/:switchId': 'Общий выключатель',
  '/cams/new': 'Добавление камеры',
  '/cams/multi-view': 'Multi-View',
  '/cams/:id': 'Камера',
  '/cams/:id/live': 'Прямой эфир',
  '/cams/:id/recordings': 'Архив камеры',
  '/switches/new': 'Добавление выключателя',
  '/switches/:id': 'Выключатель',
  '/connections/new': 'Добавление соединения',
  '/connections/:id': 'Соединение',
  '/account': 'Профиль',
  '/setup': 'Первоначальная настройка',
  '/admin': 'Админ-панель',
  '/admin/users': 'Пользователи',
  '/admin/users/:userId/sessions': 'Сессии пользователя',
  '/admin/stats': 'Статистика',
  '/admin/settings': 'Настройки системы',
  '/admin/nodes': 'Ноды',
  '/admin/cluster': 'Кластер и назначения',
}

function RouteContent({ pathname, previousPath, children }) {
  const contentRef = useRef(null)

  useLayoutEffect(() => {
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    const content = contentRef.current
    const focusTarget = content.querySelector('h1') ?? content
    if (focusTarget !== content && !focusTarget.hasAttribute('tabindex')) focusTarget.tabIndex = -1
    focusTarget.focus({ preventScroll: true })
  }, [pathname, previousPath])

  return <div ref={contentRef} data-route-content tabIndex={-1}>{children}</div>
}

export default function App() {
  const location = useLocation()
  const previousPath = useRef(location.pathname)
  useEffect(() => { tlog('этап', 'React смонтирован (App)') }, [])
  useEffect(() => { tlog('навигация', location.pathname) }, [location.pathname])
  useEffect(() => {
    const route = Object.keys(ROUTE_TITLES).find((pattern) => matchPath(pattern, location.pathname))
    document.title = `${ROUTE_TITLES[route] || 'Страница не найдена'} · ZeroHome`
  }, [location.pathname])
  return (
    <>
      <div style={orbTR} />
      <div style={orbBL} />

      <RouteErrorBoundary pathname={location.pathname}>
      <Suspense fallback={<RouteFallback />}>
      <RouteContent pathname={location.pathname} previousPath={previousPath}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route path="/share/stream/:camId" element={<SharedStreamPage />} />
        <Route path="/share/record/:camId" element={<SharedRecordingPage />} />
        <Route path="/share/switch/:switchId" element={<SharedSwitchPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/cams/new" element={<CamCreatePage />} />
            <Route path="/cams/:id" element={<CamDetailPage />} />
            <Route path="/cams/:id/live" element={<AccessGate><CamLiveViewPage /></AccessGate>} />
            <Route path="/cams/:id/recordings" element={<AccessGate><CamRecordingsPage /></AccessGate>} />
            <Route path="/cams/multi-view" element={<AccessGate><CamMultiViewPage /></AccessGate>} />
            <Route path="/switches/new" element={<SwitchCreatePage />} />
            <Route path="/switches/:id" element={<SwitchDetailPage />} />
            <Route path="/connections/new" element={<ConnectionCreatePage />} />
            <Route path="/connections/:id" element={<ConnectionDetailPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/setup" element={<SetupPage />} />

            <Route element={<ProtectedRoute adminOnly />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/users/:userId/sessions" element={<AdminUserSessionsPage />} />
              <Route path="/admin/stats" element={<StatsPage />} />
              <Route path="/admin/settings" element={<AdminSystemSettingsPage />} />
              <Route path="/admin/nodes" element={<AdminNodesPage />} />
              <Route path="/admin/cluster" element={<AdminClusterPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </RouteContent>
      </Suspense>
      </RouteErrorBoundary>

      <ToastContainer />
    </>
  )
}

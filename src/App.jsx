import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { timedImport, tlog } from './utils/timingsLog'
import { orbTR, orbBL, colors } from './styles/tokens'
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

function RouteFallback() {
  return <Spinner style={{ padding: 24 }} />
}

export default function App() {
  const location = useLocation()
  useEffect(() => { tlog('этап', 'React смонтирован (App)') }, [])
  useEffect(() => { tlog('навигация', location.pathname) }, [location.pathname])
  return (
    <>
      <div style={orbTR} />
      <div style={orbBL} />

      <Suspense fallback={<RouteFallback />}>
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
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>

      <ToastContainer />
    </>
  )
}

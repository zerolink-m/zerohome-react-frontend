import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'
import Button from './Button'
import { exchangeAccess } from '../api/auth'
import { getLegacyToken } from '../api/authStore'

export default function ProtectedRoute({ adminOnly = false }) {
  const { isAuthenticated, role, initializing, refreshProfile } = useAuth()
  const location = useLocation()

  if (initializing) {
    return <Spinner fullscreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Роль приходит только из подтверждённого профиля; непрозрачный bearer claims не содержит.
  if (adminOnly && role == null) {
    return <div style={{ textAlign: 'center', padding: 30 }}><Spinner /><p>Проверяем роль на сервере…</p><Button small onClick={() => (getLegacyToken() ? exchangeAccess().then(refreshProfile) : refreshProfile()).catch(() => {})}>Повторить</Button></div>
  }

  if (adminOnly && role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

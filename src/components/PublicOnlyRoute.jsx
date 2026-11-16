import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'

export default function PublicOnlyRoute() {
  const { isAuthenticated, initializing } = useAuth()

  if (initializing) {
    return <Spinner fullscreen />
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

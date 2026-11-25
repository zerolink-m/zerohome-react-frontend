import { useState } from 'react'
import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'

export default function PublicOnlyRoute() {
  const { isAuthenticated, initializing } = useAuth()
  const [authenticating, setAuthenticating] = useState(false)

  if (initializing) {
    return <Spinner fullscreen />
  }

  if (isAuthenticated && !authenticating) {
    return <Navigate to="/" replace />
  }

  return <Outlet context={setAuthenticating} />
}

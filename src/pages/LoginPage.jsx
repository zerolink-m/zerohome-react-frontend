import { useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router'
import { useAuth } from '../context/AuthContext'
import GlassCard from '../components/GlassCard'
import InputField from '../components/InputField'
import Button from '../components/Button'
import Divider from '../components/Divider'
import LogoFull from '../components/LogoFull'
import T from '../styles/tokens'
import { isSetupComplete } from '../utils/setupStatus'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const setAuthenticating = useOutletContext()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setAuthenticating?.(true)
    try {
      const me = await login(email, password)
      const from = location.state?.from
      const returnTo = from?.pathname ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '/'
      if (me?.id != null && isSetupComplete(me.id)) navigate(returnTo, { replace: true })
      else navigate('/setup', { replace: true, state: { afterLogin: true, returnTo } })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setAuthenticating?.(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 1,
        padding: 24,
      }}
    >
      <GlassCard>
        <h1 className="sr-only">Вход</h1>
        <div style={{ textAlign: 'center', marginBottom: 32, color: 'var(--accent)', overflow: 'hidden' }}>
          <LogoFull height={40} style={{ maxWidth: '100%', height: 'auto' }} />
        </div>
        <form onSubmit={handleSubmit}>
          <InputField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <InputField
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <div role="alert" style={{ ...T.errorBox, marginBottom: 20 }}>{error}</div>}
          <Button variant="accent" type="submit" loading={loading} style={{ width: '100%' }}>
            Войти
          </Button>
        </form>
        <Divider />
        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted-text)' }}>
          Нет аккаунта? <Link to="/register" className="text-link">Зарегистрироваться</Link>
        </div>
      </GlassCard>
    </div>
  )
}

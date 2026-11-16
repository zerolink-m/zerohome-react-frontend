import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GlassCard from '../components/GlassCard'
import InputField from '../components/InputField'
import Button from '../components/Button'
import Divider from '../components/Divider'
import LogoFull from '../components/LogoFull'
import T from '../styles/tokens'

const EMPTY = { name: '', surname: '', email: '', password: '' }

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      navigate('/setup', { replace: true, state: { afterLogin: true, returnTo: '/' } })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
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
        <div style={{ textAlign: 'center', marginBottom: 32, color: 'var(--accent)', overflow: 'hidden' }}>
          <LogoFull height={40} style={{ maxWidth: '100%', height: 'auto' }} />
        </div>
        <form onSubmit={handleSubmit}>
          <InputField label="Имя" value={form.name} onChange={(e) => update('name', e.target.value)} />
          <InputField label="Фамилия" value={form.surname} onChange={(e) => update('surname', e.target.value)} />
          <InputField
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            autoComplete="email"
          />
          <InputField
            label="Пароль"
            type="password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            autoComplete="new-password"
          />
          {error && <div style={{ ...T.errorBox, marginBottom: 20 }}>{error}</div>}
          <Button variant="accent" type="submit" loading={loading} style={{ width: '100%' }}>
            Зарегистрироваться
          </Button>
        </form>
        <Divider />
        <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          Уже есть аккаунт? <Link to="/login" style={{ color: '#9ddcff' }}>Войти</Link>
        </div>
      </GlassCard>
    </div>
  )
}

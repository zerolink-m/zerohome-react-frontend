import { Link, useLocation } from 'react-router-dom'
import T from '../styles/tokens'
import Button from './Button'
import LogoFull from './LogoFull'
import LogoShort from './LogoShort'
import { refreshDashboard } from '../utils/dashboardRefresh'
import { useToast } from '../context/ToastContext'

export default function Navbar() {
  const location = useLocation()
  const toast = useToast()

  // Клик по логотипу на главном экране обновляет данные устройств без перезагрузки браузера;
  // на других страницах — обычный переход на главную через <Link>.
  function handleLogoClick(e) {
    if (location.pathname !== '/') return
    e.preventDefault()
    if (location.hash) window.history.replaceState(null, '', '/')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    refreshDashboard()
    toast.info('Обновляем устройства…')
  }

  return (
    <nav style={T.navbar} className="app-navbar">
      <Link
        to="/"
        onClick={handleLogoClick}
        className="navbar-logo"
        style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--accent)' }}
      >
        <span className="logo-full" style={{ lineHeight: 0 }}>
          <LogoFull height={20} />
        </span>
        <span className="logo-short" style={{ lineHeight: 0 }}>
          <LogoShort height={24} />
        </span>
      </Link>

      <div className="navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link to="/" className="navbar-action">
          <Button small>Устройства</Button>
        </Link>
        <Link to="/account" className="navbar-action">
          <Button small>Профиль</Button>
        </Link>
      </div>
    </nav>
  )
}

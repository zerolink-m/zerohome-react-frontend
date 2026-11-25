import { Link, useLocation, useNavigate } from 'react-router'
import T from '../styles/tokens'
import Button from './Button'
import LogoFull from './LogoFull'
import LogoShort from './LogoShort'
import { refreshDashboard } from '../utils/dashboardRefresh'
import { useToast } from '../context/ToastContext'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()

  // Клик по логотипу на главном экране обновляет данные устройств без перезагрузки браузера;
  // на других страницах — обычный переход на главную через <Link>.
  function handleLogoClick(e) {
    if (location.pathname !== '/' || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    if (location.hash) navigate('/', { replace: true })
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    refreshDashboard()
    toast.info('Обновляем устройства…')
  }

  return (
    <nav style={T.navbar} className="app-navbar" aria-label="Основная навигация">
      <Link
        to="/"
        onClick={handleLogoClick}
        className="navbar-logo"
        aria-label="ZeroHome — устройства"
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
        <Button to="/" className="navbar-action" aria-current={location.pathname === '/' ? 'page' : undefined} small>Устройства</Button>
        <Button to="/account" className="navbar-action" aria-current={location.pathname === '/account' ? 'page' : undefined} small>Профиль</Button>
      </div>
    </nav>
  )
}

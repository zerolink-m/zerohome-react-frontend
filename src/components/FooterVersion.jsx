import T from '../styles/tokens'
import { useEffect, useState } from 'react'
import { useBackendHealth } from '../context/HealthContext'
import { getHostState, subscribeHost } from '../api/endpoints'
import packageJson from '../../package.json';

const FRONTEND_VERSION = import.meta.env.VITE_APP_VERSION || packageJson.version || '1.0.0'

// Единообразный стиль: показываем версию без ведущего `v`.
// Backend может вернуть "v3.2.0-Beta" или "3.2.0-Beta" — обрезаем префикс.
function stripV(v) {
  return v ? v.replace(/^v/i, '') : v
}

export default function FooterVersion() {
  const { online, version } = useBackendHealth()
  const [host, setHost] = useState(getHostState)
  useEffect(() => subscribeHost(setHost), [])

  let apiVersionLabel
  if (online === null) apiVersionLabel = '…'
  else if (online === false) apiVersionLabel = '(нет связи)'
  else apiVersionLabel = stripV(version) || '—'

  return (
    <div style={T.footerVersion}>
      ZeroHome API {apiVersionLabel}{host.enabled && host.active === 'main' ? ' · резервный хост' : ''}
      <br />
      Frontend {stripV(FRONTEND_VERSION)}
    </div>
  )
}

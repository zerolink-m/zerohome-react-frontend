import T from '../styles/tokens'
import { useEffect, useState } from 'react'
import { useBackendHealth } from '../context/HealthContext'
import { getHostState, subscribeHost } from '../api/endpoints'
import { FRONTEND_VERSION } from '../utils/frontendVersion'

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
      Frontend {FRONTEND_VERSION}
    </div>
  )
}

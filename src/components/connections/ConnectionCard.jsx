import { useState } from 'react'
import { Link } from 'react-router'
import DashCard from '../DashCard'
import Pill from '../Pill'
import { colors } from '../../styles/tokens'
import { formatUnixTs } from '../../utils/format'

const PROVIDER_LABELS = {
  tuya_cloud: 'Tuya Cloud',
}

export default function ConnectionCard({ connection }) {
  const [hover, setHover] = useState(false)

  const providerLabel = PROVIDER_LABELS[connection.provider] || connection.provider

  let syncLine
  if (connection.last_sync_error) {
    syncLine = (
      <span style={{ color: colors.statuses.red.text }}>
        Ошибка синка: {connection.last_sync_error}
      </span>
    )
  } else if (connection.last_synced_at) {
    syncLine = `Синхр. ${formatUnixTs(connection.last_synced_at)}`
  } else {
    syncLine = 'Ещё не синхронизировано'
  }

  return (
    <DashCard
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minWidth: 0,
        cursor: 'pointer',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: '0.25s ease',
      }}
    >
      <Link className="card-open-link" to={`/connections/${connection.id}`} aria-label={`Открыть соединение: ${connection.name || connection.id}`} />
      <div style={{ fontSize: 15, marginBottom: 10, wordBreak: 'break-word', overflowWrap: 'anywhere', paddingRight: 20 }}>
        {connection.name || `Соединение #${connection.id}`}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <Pill variant="blue">{providerLabel}</Pill>
        <Pill variant={connection.enabled ? 'green' : 'red'}>
          {connection.enabled ? 'включено' : 'выключено'}
        </Pill>
      </div>
      <div style={{ fontSize: 11, color: colors.white[3], overflowWrap: 'anywhere' }}>{syncLine}</div>
    </DashCard>
  )
}

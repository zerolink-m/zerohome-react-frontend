import { useParams, useSearchParams } from 'react-router'
import StateToggle from '../components/switches/StateToggle'
import DashCard from '../components/DashCard'
import { colors } from '../styles/tokens'

export default function SharedSwitchPage() {
  const { switchId } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  if (!token) {
    return (
      <div style={centerStyle}>
        <div style={{ fontSize: 13, color: colors.white[4] }}>Ссылка недействительна</div>
      </div>
    )
  }

  return (
    <div style={centerStyle}>
      <div style={{ width: '100%', maxWidth: 420, display: 'grid', gap: 24 }}>
        <h1 style={{ fontSize: 20, textAlign: 'center', wordBreak: 'break-all' }}>
          Выключатель #{switchId}
        </h1>
        <DashCard style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 11,
              color: colors.white[3],
              marginBottom: 16,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Состояние устройства
          </div>
          <StateToggle switchId={switchId} authToken={token} />
        </DashCard>
      </div>
    </div>
  )
}

const centerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: '#05070d',
}

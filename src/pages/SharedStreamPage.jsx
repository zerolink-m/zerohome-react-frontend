import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import VideoStreamUniversal from '../components/cams/VideoStreamUniversal'
import PTZControl from '../components/cams/PTZControl'
import DashCard from '../components/DashCard'
import { useIsMobile } from '../hooks/useIsMobile'
import { colors } from '../styles/tokens'

export default function SharedStreamPage() {
  const { camId } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const isMobile = useIsMobile()
  const [ptzUnsupported, setPtzUnsupported] = useState(false)

  if (!token) {
    return (
      <div style={centerStyle}>
        <div style={{ fontSize: 13, color: colors.white[4] }}>Ссылка недействительна</div>
      </div>
    )
  }

  return (
    <div style={centerStyle}>
      <div style={{ width: '100%', maxWidth: 900, display: 'grid', gap: 24 }}>
        <VideoStreamUniversal camId={camId} authToken={token}>
          {!isMobile && <PTZControl camId={camId} authToken={token} onUnsupported={() => setPtzUnsupported(true)} />}
        </VideoStreamUniversal>
        {isMobile && !ptzUnsupported && (
          <DashCard>
            <PTZControl camId={camId} authToken={token} onUnsupported={() => setPtzUnsupported(true)} />
          </DashCard>
        )}
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

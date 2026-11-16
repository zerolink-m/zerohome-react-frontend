import { useParams, useSearchParams } from 'react-router-dom'
import { recordingFileUrlWithToken } from '../api/cams'
import { colors } from '../styles/tokens'

export default function SharedRecordingPage() {
  const { camId } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const filename = searchParams.get('filename')

  if (!token || !filename) {
    return (
      <div style={centerStyle}>
        <div style={{ fontSize: 13, color: colors.white[4] }}>Ссылка недействительна</div>
      </div>
    )
  }

  return (
    <div style={centerStyle}>
      <div style={{ width: '100%', maxWidth: 900 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16, wordBreak: 'break-all', color: '#fff' }}>{filename}</h2>
        <video
          controls
          autoPlay
          style={{ width: '100%', borderRadius: 14, background: '#000' }}
          src={recordingFileUrlWithToken(camId, filename, token)}
        />
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

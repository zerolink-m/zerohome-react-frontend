import { useParams, useSearchParams } from 'react-router'
import { recordingFileUrlWithToken } from '../api/cams'
import { colors } from '../styles/tokens'
import RecordingVideo from '../components/cams/RecordingVideo'

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
      <div style={{ width: '100%', maxWidth: 900, color: '#fff' }}>
        <h2 style={{ fontSize: 16, marginBottom: 16, wordBreak: 'break-all', color: '#fff' }}>{filename}</h2>
        <RecordingVideo key={JSON.stringify([camId, filename, token])} src={recordingFileUrlWithToken(camId, filename, token)} errorMessage="Не удалось воспроизвести запись. Проверьте подключение и срок действия ссылки." />
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

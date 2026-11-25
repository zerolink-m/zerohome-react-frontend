import { useState } from 'react'
import Button from '../Button'

export default function RecordingVideo({ src, errorMessage = 'Не удалось воспроизвести запись.' }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div>
        <p role="alert">{errorMessage}</p>
        <Button small onClick={() => setFailed(false)}>Повторить</Button>
      </div>
    )
  }

  return (
    <video
      controls
      autoPlay
      playsInline
      style={{ display: 'block', width: '100%', maxHeight: '65vh', borderRadius: 14, background: '#000' }}
      src={src}
      onError={() => setFailed(true)}
    />
  )
}

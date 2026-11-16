import { useEffect, useState } from 'react'
import { getRecording, recordingFileUrl } from '../api/cams'
import { useToast } from '../context/ToastContext'
import Button from '../components/Button'
import ShareLinkDialog from '../components/cams/ShareLinkDialog'
import { colors } from '../styles/tokens'
import { formatUnixTs, formatBytes } from '../utils/format'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from '../components/PageLoader'

// Оверлей поверх CamRecordingsPage — не отдельная страница, чтобы список записей
// оставался на экране. filename идентифицирует запись (у записей нет отдельного id).
export default function CamRecordingPlayerPage({ camId, filename, onClose }) {
  const toast = useToast()

  const [recording, setRecording] = useState(null)
  const [loading, setLoading] = useState(true)
  const gate = useLoadGate(loading)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getRecording(camId, filename)
        if (!cancelled) setRecording(data)
      } catch (e) {
        if (!cancelled) {
          toast.error(e.message)
          onClose()
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camId, filename])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 900, background: '#05070d', borderRadius: 16, padding: 20 }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ fontSize: 16, wordBreak: 'break-all' }}>{filename}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button small onClick={() => setSharing(true)}>
              Поделиться
            </Button>
            <Button small onClick={onClose}>
              Закрыть ✕
            </Button>
          </div>
        </div>

        {gate.busy ? (
          <PageLoader gate={gate} compact />
        ) : recording ? (
          <>
            <video
              controls
              autoPlay
              style={{ width: '100%', borderRadius: 14, background: '#000' }}
              src={recordingFileUrl(camId, filename)}
            />
            <div style={{ fontSize: 12, color: colors.white[4], marginTop: 12 }}>
              {formatUnixTs(recording.started_at)} · {recording.format} · {formatBytes(recording.size_bytes)}
            </div>
          </>
        ) : null}
      </div>

      <ShareLinkDialog
        open={sharing}
        camId={camId}
        deviceType="cams"
        type="record"
        filename={filename}
        onClose={() => setSharing(false)}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { getRecording, recordingFileUrl } from '../api/cams'
import Button from '../components/Button'
import Dialog from '../components/Dialog'
import ShareLinkDialog from '../components/cams/ShareLinkDialog'
import RecordingVideo from '../components/cams/RecordingVideo'
import { colors } from '../styles/tokens'
import { formatUnixTs, formatBytes } from '../utils/format'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from '../components/PageLoader'

// Оверлей поверх CamRecordingsPage — не отдельная страница, чтобы список записей
// оставался на экране. filename идентифицирует запись (у записей нет отдельного id).
export default function CamRecordingPlayerPage({ camId, filename, canShare, onClose }) {
  const [recording, setRecording] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [retry, setRetry] = useState(0)
  const gate = useLoadGate(loading, loadError)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const data = await getRecording(camId, filename)
        if (!cancelled) setRecording(data)
      } catch (e) {
        if (!cancelled) setLoadError(e.message || 'Не удалось загрузить данные записи')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [camId, filename, retry])

  return (
    <Dialog open title="Просмотр записи" onClose={onClose} style={{ width: 'min(100%, 940px)', padding: 20, background: 'var(--bg)', color: 'var(--text)' }}>
      <div>
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
            {canShare && recording && <Button small onClick={() => setSharing(true)}>
              Поделиться
            </Button>}
            <Button small data-dialog-initial-focus onClick={onClose}>
              Закрыть ✕
            </Button>
          </div>
        </div>

        {gate.busy ? (
          <PageLoader gate={gate} compact onRetry={() => setRetry(value => value + 1)} />
        ) : recording ? (
          <>
            <RecordingVideo src={recordingFileUrl(camId, filename)} />
            <div style={{ fontSize: 12, color: colors.white[4], marginTop: 12 }}>
              {formatUnixTs(recording.started_at)} · {recording.format} · {formatBytes(recording.size_bytes)}
            </div>
          </>
        ) : null}
      </div>

      {canShare && <ShareLinkDialog
        open={sharing}
        camId={camId}
        deviceType="cams"
        type="record"
        filename={filename}
        onClose={() => setSharing(false)}
      />}
    </Dialog>
  )
}

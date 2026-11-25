import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { getCam, listRecordings, recordingSnapshotUrl } from '../api/cams'
import { ApiError } from '../api/client'
import { CODES } from '../api/codes'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { DEFAULT_LIMIT } from '../api/pagination'
import Button from '../components/Button'
import DashCard from '../components/DashCard'
import InputField from '../components/InputField'
import Pagination from '../components/Pagination'
import CamRecordingPlayerPage from './CamRecordingPlayerPage'
import { colors } from '../styles/tokens'
import { formatUnixTs, formatBytes, unixTsToLocalInput, localInputToUnixTs } from '../utils/format'
import PhotoFrame from '../components/PhotoFrame'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from '../components/PageLoader'

const MAX_RECORDINGS_LIMIT = 100

export default function CamRecordingsPage() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()
  const { role, uid } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawOffset = Number(searchParams.get('offset'))
  const rawLimit = Number(searchParams.get('limit'))
  const offset = Number.isSafeInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0
  const limit = Number.isSafeInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_RECORDINGS_LIMIT) : DEFAULT_LIMIT
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const openRecording = searchParams.get('recording') || null
  const requestKey = JSON.stringify([id, offset, limit, from, to])

  function patchParams(patch) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '' || value === undefined) next.delete(key)
        else next.set(key, value)
      }
      return next
    })
  }

  const [cam, setCam] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const current = result?.key === requestKey ? result : null
  const data = current?.data
  const gate = useLoadGate(loading || !current, current?.error)
  const currentCam = String(cam?.id) === String(id) ? cam : null
  const canShare = role === 'admin' || (uid != null && currentCam && String(currentCam.owner) === String(uid))

  useEffect(() => {
    let cancelled = false
    getCam(id)
      .then(value => { if (!cancelled) setCam(value) })
      .catch((e) => { if (!cancelled) toast.error(e.message) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await listRecordings(id, { offset, limit, from: from || undefined, to: to || undefined })
        if (!cancelled) setResult({ key: requestKey, data: res })
      } catch (e) {
        if (cancelled) return
        if (
          e instanceof ApiError &&
          (e.code === CODES.RECORDING_NOT_CONFIGURED || e.code === CODES.RECORDING_NOT_ALLOWED)
        ) {
          toast.error(e.message)
          navigate(`/cams/${id}`)
        } else {
          setResult({ key: requestKey, error: e.message || 'Не удалось загрузить записи' })
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
  }, [id, offset, limit, from, to, requestKey, retry])

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ fontSize: 20, wordBreak: 'break-all' }}>
          Архив записей{currentCam ? ` — ${currentCam.name || `${currentCam.address}:${currentCam.port}`}` : ''}
        </h1>
        <Button onClick={() => navigate(`/cams/${id}`)}>← к камере</Button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <div style={{ minWidth: 200 }}>
          <InputField
            label="От"
            type="datetime-local"
            value={unixTsToLocalInput(from)}
            onChange={(e) => patchParams({ offset: null, from: localInputToUnixTs(e.target.value) })}
          />
        </div>
        <div style={{ minWidth: 200 }}>
          <InputField
            label="До"
            type="datetime-local"
            value={unixTsToLocalInput(to)}
            onChange={(e) => patchParams({ offset: null, to: localInputToUnixTs(e.target.value) })}
          />
        </div>
      </div>

      {gate.busy ? (
        <PageLoader gate={gate} onRetry={() => setRetry(value => value + 1)} />
      ) : data.items.length === 0 ? (
        <div style={{ fontSize: 13, color: colors.white[4] }}>Записи не найдены</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {data.items.map((rec) => (
            <DashCard
              key={rec.filename}
              onClick={() => patchParams({ recording: rec.filename })}
              style={{ flex: '1 1 220px', minWidth: 200, maxWidth: 260, cursor: 'pointer', padding: 12 }}
            >
              <PhotoFrame
                src={recordingSnapshotUrl(id, rec.filename, 4)}
                alt=""
                style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 10, marginBottom: 10 }}
              />
              <button type="button" onClick={(event) => { event.stopPropagation(); patchParams({ recording: rec.filename }) }} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: 12, wordBreak: 'break-all', padding: 0, marginBottom: 4, textAlign: 'start' }}>{rec.filename}</button>
              <div style={{ fontSize: 11, color: colors.white[4] }}>
                {formatUnixTs(rec.started_at)} · {rec.format} · {formatBytes(rec.size_bytes)}
              </div>
            </DashCard>
          ))}
        </div>
      )}

      {!gate.busy && <Pagination
        offset={offset}
        limit={limit}
        total={data.total}
        maxLimit={MAX_RECORDINGS_LIMIT}
        onChange={(patch) => patchParams(patch)}
      />}

      {openRecording && (
        <CamRecordingPlayerPage
          key={`${id}:${openRecording}`}
          camId={id}
          filename={openRecording}
          canShare={canShare}
          onClose={() => patchParams({ recording: null })}
        />
      )}
    </div>
  )
}

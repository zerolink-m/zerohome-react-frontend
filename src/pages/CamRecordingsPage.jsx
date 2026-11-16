import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getCam, listRecordings, recordingSnapshotUrl } from '../api/cams'
import { ApiError } from '../api/client'
import { CODES } from '../api/codes'
import { useToast } from '../context/ToastContext'
import { DEFAULT_LIMIT } from '../api/pagination'
import DashCard from '../components/DashCard'
import Button from '../components/Button'
import InputField from '../components/InputField'
import Pagination from '../components/Pagination'
import CamRecordingPlayerPage from './CamRecordingPlayerPage'
import { colors } from '../styles/tokens'
import { formatUnixTs, formatBytes, unixTsToLocalInput, localInputToUnixTs } from '../utils/format'
import PhotoFrame from '../components/PhotoFrame'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from '../components/PageLoader'

export default function CamRecordingsPage() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const offset = Number(searchParams.get('offset') || 0)
  const limit = Number(searchParams.get('limit') || DEFAULT_LIMIT)
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const openRecording = searchParams.get('recording') || null

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
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const gate = useLoadGate(loading)

  useEffect(() => {
    getCam(id)
      .then(setCam)
      .catch((e) => toast.error(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await listRecordings(id, { offset, limit, from: from || undefined, to: to || undefined })
        if (!cancelled) setData(res)
      } catch (e) {
        if (
          e instanceof ApiError &&
          (e.code === CODES.RECORDING_NOT_CONFIGURED || e.code === CODES.RECORDING_NOT_ALLOWED)
        ) {
          toast.error(e.message)
          navigate(`/cams/${id}`)
        } else if (!cancelled) {
          toast.error(e.message)
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
  }, [id, offset, limit, from, to])

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
          Архив записей{cam ? ` — ${cam.name || `${cam.address}:${cam.port}`}` : ''}
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
        <PageLoader gate={gate} />
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
              <div style={{ fontSize: 12, wordBreak: 'break-all', marginBottom: 4 }}>{rec.filename}</div>
              <div style={{ fontSize: 11, color: colors.white[4] }}>
                {formatUnixTs(rec.started_at)} · {rec.format} · {formatBytes(rec.size_bytes)}
              </div>
            </DashCard>
          ))}
        </div>
      )}

      <Pagination
        offset={offset}
        limit={limit}
        total={data.total}
        onChange={(patch) => patchParams(patch)}
      />

      {openRecording && (
        <CamRecordingPlayerPage
          camId={id}
          filename={openRecording}
          onClose={() => patchParams({ recording: null })}
        />
      )}
    </div>
  )
}

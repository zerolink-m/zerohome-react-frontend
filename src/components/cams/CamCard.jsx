import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import DashCard from '../DashCard'
import Spinner from '../Spinner'
import Button from '../Button'
import { colors } from '../../styles/tokens'
import { getBaseUrl, getValidAccessToken } from '../../api/client'
import { timedFetch } from '../../utils/timingsLog'
import { getState } from '../../api/authStore'
import { sanitizeSnapshot } from '../../api/snapshots'

export default function CamCard({ cam }) {
  const [hover, setHover] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageSrc, setImageSrc] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let objectUrl = null
    setImageError(false)
    setImageSrc(null)

    const fetchSnapshot = async () => {
      try {
        // Токен может ещё обновляться фоном (интерфейс открывается сразу) — ждём его.
        const token = await getValidAccessToken()
        if (!token) {
          setImageError(true)
          return
        }

        const response = await timedFetch(`${getBaseUrl()}/cams/${cam.id}/snapshot`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          setImageError(true)
          return
        }

        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        setImageSrc(objectUrl)
      } catch (err) {
        setImageError(true)
      }
    }

    fetchSnapshot()

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [cam.id, attempt])

  return (
    <DashCard
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minWidth: 0,
        cursor: 'pointer',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: '0.25s ease',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <Link className="card-open-link" to={`/cams/${cam.id}`} state={{ preview: sanitizeSnapshot(cam), uid: getState().uid }} aria-label={`Открыть камеру: ${cam.name || cam.id}`} />
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: cam.enabled ? 'rgba(0,220,130,0.9)' : 'rgba(255,255,255,0.25)',
          boxShadow: cam.enabled ? '0 0 8px rgba(0,220,130,0.6)' : 'none',
          zIndex: 1,
        }}
      />

      {/* Превью снимка */}
      <div
        style={{
          width: '100%',
          height: 180,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {imageSrc && !imageError ? (
          <img
            src={imageSrc}
            alt={cam.name || 'Камера'}
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          imageError ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 12, color: colors.white[4] }}>Не удалось загрузить</div>
              <Button
                small
                className="card-action"
                onClick={(e) => {
                  e.stopPropagation()
                  setAttempt((a) => a + 1)
                }}
              >
                Повторить
              </Button>
            </div>
          ) : (
            <Spinner label="Загрузка снимка…" />
          )
        )}
      </div>

      {/* Информация о камере */}
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 15, marginBottom: 12, wordBreak: 'break-word', overflowWrap: 'anywhere', paddingRight: 20 }}>
          {cam.name || `${cam.address}${cam.port ? `:${cam.port}` : ''}${cam.path || ''}`}
        </div>
        <div style={{ fontSize: 11, color: colors.white[2] }}>id: {cam.id}</div>
      </div>
    </DashCard>
  )
}

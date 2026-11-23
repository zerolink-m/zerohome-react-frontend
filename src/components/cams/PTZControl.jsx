import { useEffect, useRef, useState } from 'react'
import { getPtz, setPtz } from '../../api/cams'
import { ApiError } from '../../api/client'
import { CODES } from '../../api/codes'
import { useToast } from '../../context/ToastContext'
import Button from '../Button'
import { useIsMobile } from '../../hooks/useIsMobile'
import { colors } from '../../styles/tokens'
import Spinner from '../Spinner'

const STEP = 0.1
const clamp = (v) => Math.max(-1, Math.min(1, v))

// onUnsupported — вызывается, когда камера не поддерживает PTZ (CODES.PTZ_NOT_CONFIGURED): компонент при этом ничего
// не рисует, а родитель может убрать свою обёртку (карточку).
export default function PTZControl({ camId, authToken, onUnsupported }) {
  const toast = useToast()
  const isMobile = useIsMobile()
  const [pos, setPos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [notConfigured, setNotConfigured] = useState(false)
  const lockTimer = useRef(null)
  const ptzOpts = authToken ? { shareToken: authToken } : undefined

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const p = await getPtz(camId, ptzOpts)
        if (!cancelled) setPos(p)
      } catch (e) {
        if (e instanceof ApiError && e.code === CODES.PTZ_NOT_CONFIGURED) {
          if (!cancelled) setNotConfigured(true)
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
  }, [camId, authToken])

  useEffect(() => {
    if (notConfigured && onUnsupported) onUnsupported()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notConfigured])

  useEffect(() => () => clearTimeout(lockTimer.current), [])

  function armLocalLock() {
    setLocked(true)
    clearTimeout(lockTimer.current)
    lockTimer.current = setTimeout(() => setLocked(false), 1000)
  }

  async function refresh() {
    try {
      const p = await getPtz(camId, ptzOpts)
      setPos(p)
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function move(delta) {
    if (!pos || locked) return
    const next = {
      pan: clamp(pos.pan + (delta.pan || 0)),
      tilt: clamp(pos.tilt + (delta.tilt || 0)),
      zoom: clamp(pos.zoom + (delta.zoom || 0)),
    }
    setPos(next)
    armLocalLock()
    try {
      await setPtz(camId, next, ptzOpts)
    } catch (e) {
      if (e instanceof ApiError && e.code === CODES.PTZ_LOCKED) {
        toast.warning('Камера временно заблокирована другой PTZ-командой')
      } else if (e instanceof ApiError && e.code === CODES.PTZ_NOT_CONFIGURED) {
        setNotConfigured(true)
      } else {
        toast.error(e.message)
      }
    }
  }

  // Камера без PTZ: блок управления не показываем вовсе.
  if (notConfigured) return null
  if (loading) {
    return <Spinner inline label="Загрузка PTZ…" />
  }

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: colors.white[3],
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 12,
        }}
      >
        PTZ-управление
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${isMobile ? 56 : 48}px)`, gap: 8, marginBottom: 16 }}>
        <div />
        <Button small={!isMobile} disabled={locked} onClick={() => move({ tilt: STEP })}>
          ↑
        </Button>
        <div />
        <Button small={!isMobile} disabled={locked} onClick={() => move({ pan: -STEP })}>
          ←
        </Button>
        <Button small={!isMobile} disabled={locked} onClick={refresh}>
          ⟳
        </Button>
        <Button small={!isMobile} disabled={locked} onClick={() => move({ pan: STEP })}>
          →
        </Button>
        <div />
        <Button small={!isMobile} disabled={locked} onClick={() => move({ tilt: -STEP })}>
          ↓
        </Button>
        <div />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button small={!isMobile} disabled={locked} onClick={() => move({ zoom: -STEP })}>
          zoom −
        </Button>
        <Button small={!isMobile} disabled={locked} onClick={() => move({ zoom: STEP })}>
          zoom +
        </Button>
        {pos && (
          <span style={{ fontSize: 11, color: colors.white[3] }}>
            pan {pos.pan.toFixed(2)} · tilt {pos.tilt.toFixed(2)} · zoom {pos.zoom.toFixed(2)}
          </span>
        )}
      </div>
      {locked && (
        <div style={{ fontSize: 11, color: colors.statuses.yellow.text, marginTop: 8 }}>
          Блокировка 1с после команды...
        </div>
      )}
    </div>
  )
}

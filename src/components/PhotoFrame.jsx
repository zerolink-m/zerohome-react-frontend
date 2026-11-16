import { useCallback, useEffect, useState } from 'react'
import Spinner from './Spinner'
import Button from './Button'
import { colors } from '../styles/tokens'
import { tlog, fmtBytes, isTimingsLogging } from '../utils/timingsLog'

// Изображение с состояниями: загрузка (спиннер с подписью на месте фото) → готово | ошибка
// («Не удалось загрузить» + «Повторить», вместо нативной иконки битого изображения).
//   src   — прямой URL (<img src>) ИЛИ
//   load  — async () => Blob (для эндпоинтов с Authorization); перезапрашивается при повторе.
//   style — стиль рамки (размеры/скругление), img заполняет её целиком.
export default function PhotoFrame({ src, load, alt = '', style, imgStyle, className, loadingLabel = 'Загрузка фото…' }) {
  const [attempt, setAttempt] = useState(0)
  const [url, setUrl] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error

  useEffect(() => {
    let cancelled = false
    let objectUrl = null
    setStatus('loading')
    setUrl(null)
    const t0 = isTimingsLogging ? performance.now() : 0
    if (load) {
      load()
        .then((blob) => {
          if (cancelled) return
          if (t0) tlog('фото', alt || 'blob', `${Math.round(performance.now() - t0)}ms, ${fmtBytes(blob.size)}, источник: см. строку API`)
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
        })
        .catch(() => !cancelled && setStatus('error'))
    } else if (src) {
      // Повтор: добавляем счётчик, чтобы браузер не взял закешированную ошибку.
      setUrl(attempt ? `${src}${src.includes('?') ? '&' : '?'}r=${attempt}` : src)
    } else {
      setStatus('error')
    }
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, attempt])

  const retry = useCallback((e) => {
    e.stopPropagation()
    setAttempt((a) => a + 1)
  }, [])

  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden', background: 'var(--w06)', ...style }}>
      {url && status !== 'error' && (
        <img
          src={url}
          alt={alt}
          onLoad={() => setStatus('ready')}
          onError={() => setStatus('error')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: status === 'ready' ? 1 : 0,
            transition: 'opacity 0.25s ease',
            ...imgStyle,
          }}
        />
      )}
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner label={loadingLabel} />
        </div>
      )}
      {status === 'error' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 8,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 12, color: colors.white[4] }}>Не удалось загрузить</div>
          <Button small onClick={retry}>
            Повторить
          </Button>
        </div>
      )}
    </div>
  )
}

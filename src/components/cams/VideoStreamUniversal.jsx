import { useEffect, useState, useRef, useCallback } from 'react'
import { getSupportedStreams, getSupportedStreamsRetryDelay } from '../../api/streaming'
import { checkWebRTCAvailability, subscribeToWebRTCChanges } from '../../api/webrtcCheck'
import { checkBrowserSupport, selectBestFormat, getFormatDescription } from '../../utils/streamFormats'
import { useTheme } from '../../context/ThemeContext'
import { debugLog } from '../../utils/debugLog'
import WebRTCPlayer from './WebRTCPlayer'
import { webrtcLog } from '../../utils/webrtcDebug'
import HLSPlayer from './HLSPlayer'
import FMP4Player from './FMP4Player'
import LatencyIndicator from './LatencyIndicator'
import Spinner from '../Spinner'

const overlayBtnStyle = {
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 11,
  padding: '6px 10px',
  cursor: 'pointer',
}

const overlayCardStyle = {
  position: 'absolute',
  bottom: 10,
  left: 10,
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 12,
  backdropFilter: 'blur(10px)',
  padding: 12,
  maxWidth: 'calc(100% - 20px)',
}

const FORMAT_NAMES = { webrtc: 'WebRTC', hls: 'HLS', fmp4: 'fMP4' }
const makeFormat = (list, key) =>
  list.find(f => f.format === key) || { format: key, name: FORMAT_NAMES[key] || key, enabled: true, latency: '' }

// Универсальный видео стрим с автоматическим выбором формата
// Приоритеты: предпочитаемый протокол из настроек > остальные по умолчанию (WebRTC > HLS > fMP4)
// latencyOverlay — показывать задержку поверх видео (в сетке multi-view), а не над окном.
export default function VideoStreamUniversal({ camId, authToken, children, latencyOverlay = false }) {
  const containerRef = useRef(null)
  const formatButtonRef = useRef(null)
  const latencySetterRef = useRef(null)
  const handleLatency = useCallback((v) => latencySetterRef.current?.(v), [])
  const { preferredStreamFormat } = useTheme()
  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedFormat, setSelectedFormat] = useState(null)
  const [supportedFormats, setSupportedFormats] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [showFormatSelector, setShowFormatSelector] = useState(false)
  const [attempt, setAttempt] = useState(0) // счётчик попыток — перемонтирует плеер
  const [reconnectMsg, setReconnectMsg] = useState('')
  const retryTimerRef = useRef(null)
  const [forcedFormat, setForcedFormat] = useState(null)
  const forcedRef = useRef(null)
  forcedRef.current = forcedFormat
  const [formatRequest, setFormatRequest] = useState(0)
  const [forceChoice, setForceChoice] = useState(false)
  const cycleRef = useRef(0) // сколько полных кругов по форматам без успеха
  const manualFormatRef = useRef(null) // формат, выбранный пользователем вручную
  const webrtcOkRef = useRef(true)
  const formatsRef = useRef([])
  const currentFormatRef = useRef(null)
  const preferredRef = useRef(preferredStreamFormat)
  preferredRef.current = preferredStreamFormat
  currentFormatRef.current = selectedFormat?.format
  formatsRef.current = supportedFormats

  useEffect(() => () => {
    clearTimeout(retryTimerRef.current)
    retryTimerRef.current = null
  }, [camId, authToken])
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => {
      const el = document.fullscreenElement || document.webkitFullscreenElement
      setIsFullscreen(!!el && el === containerRef.current)
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const current = document.fullscreenElement || document.webkitFullscreenElement
    if (current === el) {
      ;(document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
      return
    }
    const req = el.requestFullscreen || el.webkitRequestFullscreen
    if (req) {
      Promise.resolve(req.call(el)).catch(() => {})
      return
    }
    // iPhone Safari: нет fullscreen для элементов — используем нативный режим <video>
    const video = el.querySelector('video')
    if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen()
  }, [])

  // Загрузка поддерживаемых форматов
  useEffect(() => {
    let cancelled = false
    let timer = null

    async function loadFormats() {
      try {
        debugLog('stream', 'loading supported formats')
        const data = await getSupportedStreams({ refresh: formatRequest > 0 })

        if (cancelled) return

        const formats = data.filter(item => item && Object.prototype.hasOwnProperty.call(FORMAT_NAMES, item.format))
        debugLog('stream', 'supported formats from server', formats)

        setSupportedFormats(formats)

        // Проверяем доступность WebRTC через специальный endpoint
        const webrtcServerAvailable = await checkWebRTCAvailability()
        if (cancelled) return
        webrtcOkRef.current = webrtcServerAvailable
        debugLog('stream', 'webrtc server availability check', { available: webrtcServerAvailable })

        // Автоматический выбор оптимального формата
        const browserSupport = checkBrowserSupport()
        debugLog('stream', 'browser support', browserSupport)

        // Если WebRTC недоступен на сервере, отключаем его в browserSupport
        const effectiveSupport = {
          ...browserSupport,
          webrtc: browserSupport.webrtc && webrtcServerAvailable
        }

        debugLog('stream', 'effective support (after server check)', effectiveSupport)

        // Выбираем формат с учётом предпочтения пользователя
        const best = forcedRef.current
          ? makeFormat(formats, forcedRef.current)
          : formats.find(f => f.enabled && f.format === manualFormatRef.current) ||
            selectBestFormat(formats.filter(f => effectiveSupport[f.format]), effectiveSupport, preferredStreamFormat)
        debugLog('stream', 'selected format', best)

        setSelectedFormat(best)
        setErrorMessage('')
        setStatus('ready')
      } catch (e) {
        if (cancelled) return
        debugLog('stream', 'error loading formats', e)
        setStatus('error')
        setErrorMessage('Не удалось загрузить список форматов. Повторяем попытку…')
        timer = setTimeout(loadFormats, getSupportedStreamsRetryDelay())
      }
    }

    loadFormats()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [preferredStreamFormat, formatRequest])

  // Подписка на изменения доступности WebRTC
  useEffect(() => {
    const unsubscribe = subscribeToWebRTCChanges((available) => {
      debugLog('stream', 'webrtc availability changed', { available })
      webrtcOkRef.current = available
      if (forcedRef.current) return

      // Если изменилась доступность WebRTC, пересматриваем выбор формата
      const browserSupport = checkBrowserSupport()
      const effectiveSupport = {
        ...browserSupport,
        webrtc: browserSupport.webrtc && available
      }

      debugLog('stream', 'recalculating format due to webrtc change', { effectiveSupport })

      // Если текущий формат - WebRTC и он стал недоступен
      if (selectedFormat?.format === 'webrtc' && !available) {
        debugLog('stream', 'webrtc became unavailable, switching format')
        // Пересчитываем лучший формат
        const best = selectBestFormat(supportedFormats.filter(f => effectiveSupport[f.format]), effectiveSupport, manualFormatRef.current || preferredStreamFormat)
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
        setReconnectMsg('')
        setSelectedFormat(best)
        setIsPlaying(false)
      }
      // Если WebRTC стал доступен и это предпочитаемый формат
      else if (effectiveSupport.webrtc && (!selectedFormat || (manualFormatRef.current || preferredStreamFormat) === 'webrtc') && selectedFormat?.format !== 'webrtc') {
        debugLog('stream', 'webrtc became available, switching to preferred format')
        const webrtcFormat = supportedFormats.find(f => f.format === 'webrtc' && f.enabled)
        if (webrtcFormat) {
          clearTimeout(retryTimerRef.current)
          retryTimerRef.current = null
          setReconnectMsg('')
          setSelectedFormat(webrtcFormat)
          setIsPlaying(false)
        }
      }
    })

    return unsubscribe
  }, [selectedFormat, supportedFormats, preferredStreamFormat])

  // Порядок попыток: выбранное вручную / предпочитаемое → WebRTC (если доступен) → HLS → fMP4.
  // Попытки циклические: после последнего формата снова идём с начала, не останавливаясь.
  const buildOrder = useCallback(() => {
    const support = checkBrowserSupport()
    support.webrtc = support.webrtc && webrtcOkRef.current
    const first = manualFormatRef.current || preferredRef.current
    const priority = [first, ...['webrtc', 'hls', 'fmp4'].filter(f => f !== first)]
    return priority.filter(f => support[f] && formatsRef.current.some(s => s.enabled && s.format === f))
  }, [])

  const handleError = useCallback((message) => {
    if (retryTimerRef.current) return // повторная попытка уже запланирована
    const current = currentFormatRef.current
    debugLog('stream', 'format failed', { format: current, message })
    webrtcLog('ошибка формата, автопереподключение', { format: current, причина: message })

    if (forcedRef.current) {
      // Принудительный режим: всегда стучимся только в выбранный формат, игнорируя любые условия
      setIsPlaying(false)
      setReconnectMsg(message || 'Ошибка потока')
      cycleRef.current += 1
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null
        setSelectedFormat(makeFormat(formatsRef.current, forcedRef.current))
        setAttempt(a => a + 1)
      }, Math.min(1000 * cycleRef.current, 5000))
      webrtcLog('повтор запланирован (принудительный формат)', { format: current, задержка_мс: Math.min(1000 * cycleRef.current, 5000) })
      return
    }

    const order = buildOrder()
    if (order.length === 0) {
      // Нет подходящих форматов — перепроверим список позже
      order.push(current)
    }
    const idx = order.indexOf(current)
    const nextIdx = (idx + 1) % order.length
    const wrapped = idx === -1 ? false : idx + 1 >= order.length
    if (wrapped) cycleRef.current += 1
    const delay = wrapped ? Math.min(1500 * cycleRef.current, 10000) : 300
    webrtcLog('повтор запланирован', { из: current, в: order[nextIdx], задержка_мс: delay, круг: cycleRef.current })

    setIsPlaying(false)
    setReconnectMsg(message || 'Ошибка потока')
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null
      const next = formatsRef.current.find(f => f.enabled && f.format === order[nextIdx])
      if (next) setSelectedFormat(next)
      setAttempt(a => a + 1)
    }, delay)
  }, [buildOrder])

  const handlePlaying = useCallback(() => {
    cycleRef.current = 0
    setReconnectMsg('')
    setIsPlaying(true)
  }, [])

  const changeFormat = (format) => {
    const nextForced = forceChoice ? format.format : null
    setForcedFormat(nextForced)
    forcedRef.current = nextForced
    manualFormatRef.current = format.format
    clearTimeout(retryTimerRef.current)
    retryTimerRef.current = null
    cycleRef.current = 0
    setSelectedFormat(format)
    setShowFormatSelector(false)
    formatButtonRef.current?.focus()
    setIsPlaying(false)
    setReconnectMsg('')
    setAttempt(a => a + 1)
  }

  function refreshFormats(autoSelect = false) {
    if (autoSelect) {
      manualFormatRef.current = null
      forcedRef.current = null
      setForcedFormat(null)
      setForceChoice(false)
    }
    clearTimeout(retryTimerRef.current)
    retryTimerRef.current = null
    cycleRef.current = 0
    setSelectedFormat(null)
    setIsPlaying(false)
    setReconnectMsg('')
    setStatus('loading')
    setFormatRequest(value => value + 1)
  }

  const enabledFormats = supportedFormats.filter(f => f.enabled)

  return (
    <div>
    {!latencyOverlay && !isFullscreen && <LatencyIndicator setterRef={latencySetterRef} />}
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: isFullscreen ? undefined : '16 / 9',
        height: isFullscreen ? '100%' : undefined,
        background: '#000',
        borderRadius: isFullscreen ? 0 : 14,
        overflow: 'hidden',
      }}
    >
      {!selectedFormat && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 8, padding: '8px 8px 36px', color: '#eee', textAlign: 'center', fontSize: 12 }}>
          {status === 'loading' ? <Spinner /> : (
            <>
              <div role={status === 'error' ? 'alert' : 'status'}>{status === 'error' ? errorMessage : 'Нет доступных форматов'}</div>
              <button type="button" style={overlayBtnStyle} onClick={() => refreshFormats()}>Повторить</button>
            </>
          )}
        </div>
      )}
      {(latencyOverlay || isFullscreen) && <LatencyIndicator setterRef={latencySetterRef} overlay />}
      {selectedFormat?.format === 'webrtc' && (
        <>
          {debugLog('stream', 'rendering WebRTCPlayer component')}
          <WebRTCPlayer
            key={`webrtc-${camId}-${attempt}`}
            camId={camId}
            authToken={authToken}
            onError={handleError}
            onPlaying={handlePlaying}
          />
        </>
      )}

      {selectedFormat?.format === 'hls' && (
        <>
          {debugLog('stream', 'rendering HLSPlayer component')}
          <HLSPlayer
            key={`hls-${camId}-${attempt}`}
            camId={camId}
            authToken={authToken}
            onError={handleError}
            onPlaying={handlePlaying}
            onLatency={handleLatency}
          />
        </>
      )}

      {selectedFormat?.format === 'fmp4' && (
        <>
          {debugLog('stream', 'rendering FMP4Player component')}
          <FMP4Player
            key={`fmp4-${camId}-${attempt}`}
            camId={camId}
            authToken={authToken}
            onError={handleError}
            onPlaying={handlePlaying}
          />
        </>
      )}

      {!isPlaying && reconnectMsg && (
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 2, ...overlayBtnStyle, cursor: 'default', textAlign: 'center' }}>
          {reconnectMsg} — переподключение…
        </div>
      )}

      {isPlaying && children && <div style={overlayCardStyle}>{children}</div>}

      {(selectedFormat || enabledFormats.length > 0) && (
        <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 8, zIndex: 51 }}>
          <button
            type="button"
            ref={formatButtonRef}
            onClick={() => {
              if (!showFormatSelector) setForceChoice(Boolean(forcedFormat))
              setShowFormatSelector(value => !value)
            }}
            style={overlayBtnStyle}
            aria-expanded={showFormatSelector}
          >
            {selectedFormat ? getFormatDescription(selectedFormat.format) : 'Выбрать формат'}{forcedFormat ? ' • зафиксирован' : ''}
          </button>
          {isPlaying && (
            <button
              type="button"
              onClick={toggleFullscreen}
              style={overlayBtnStyle}
              aria-label={isFullscreen ? 'Выйти из полного экрана' : 'Во весь экран'}
            >
              {isFullscreen ? '⤡ Свернуть' : '⤢ Во весь экран'}
            </button>
          )}
        </div>
      )}

      {showFormatSelector && (
        <div
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            setShowFormatSelector(false)
            formatButtonRef.current?.focus()
          }}
          style={{
            position: 'absolute',
            bottom: 46,
            right: 10,
            zIndex: 52,
            background: 'rgba(0,0,0,0.94)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12,
            padding: 12,
            width: 'min(240px, calc(100% - 20px))',
            maxHeight: 'calc(100% - 50px)',
            overflowY: 'auto',
            color: '#eee',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 8 }}>
            <input type="checkbox" checked={forceChoice} onChange={event => setForceChoice(event.target.checked)} />
            Использовать только выбранный формат
          </label>
          {enabledFormats.map(format => (
            <button
              type="button"
              key={format.format}
              aria-pressed={selectedFormat?.format === format.format}
              onClick={() => changeFormat(format)}
              style={{
                ...overlayBtnStyle,
                width: '100%',
                marginBottom: 6,
                textAlign: 'start',
                background: selectedFormat?.format === format.format ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.05)',
              }}
            >
              <span style={{ fontWeight: 600 }}>{format.name || FORMAT_NAMES[format.format]}</span>
              {forcedFormat === format.format && <span style={{ marginLeft: 6, color: '#ffb454' }}>Зафиксирован</span>}
              {format.latency && <span style={{ display: 'block', opacity: 0.7 }}>{format.latency}</span>}
            </button>
          ))}
          <button type="button" style={overlayBtnStyle} onClick={() => {
            setShowFormatSelector(false)
            formatButtonRef.current?.focus()
            refreshFormats(true)
          }}>Автовыбор</button>
        </div>
      )}
    </div>
    </div>
  )
}

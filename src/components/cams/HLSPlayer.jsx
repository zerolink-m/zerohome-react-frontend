import { useEffect, useRef, useState } from 'react'
import StreamStages from './StreamStages'
import { hlsPlaylistUrl } from '../../api/streaming'
import { debugLog, DEBUG_LOGGING } from '../../utils/debugLog'
import { diagnoseNativeHls } from '../../utils/hlsDiagnostics'
import { ensureServerClock, getServerNowSeconds, hasServerClock, toEpochSeconds } from '../../api/serverTime'

// Имя сегмента: seg_<seq>_<timestamp>.ts. Считаем, что timestamp — время начала сегмента (UTC).
const SEGMENT_RE = /seg_\d+_(\d+(?:\.\d+)?)\.ts/
const LATENCY_SANE_MAX_SECONDS = 600 // больше — значит часы/единицы не сошлись, не показываем

// HLS player с использованием hls.js или нативной поддержки
const HLS_STEPS = ['Запрос плейлиста', 'Манифест получен', 'Загрузка сегментов', 'Воспроизведение']

export default function HLSPlayer({ camId, authToken, onError, onPlaying, onLatency }) {
  const videoRef = useRef(null)
  const onLatencyRef = useRef(onLatency)
  onLatencyRef.current = onLatency
  const hlsRef = useRef(null)
  const [status, setStatus] = useState('connecting')
  const [errorMessage, setErrorMessage] = useState('')
  const [stage, setStage] = useState(0)
  const [failedStage, setFailedStage] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const stageRef = useRef(0)
  // Реальные этапы (только растут): 0 — запрос плейлиста, 1 — манифест/метаданные получены,
  // 2 — первый сегмент загружен (canplay), 3 — воспроизведение (playing).
  const bump = (n) => {
    if (n > stageRef.current) {
      stageRef.current = n
      setStage(n)
    }
  }

  function retry() {
    stageRef.current = 0
    setStage(0)
    setFailedStage(null)
    setErrorMessage('')
    setStatus('connecting')
    setAttempt((a) => a + 1)
  }

  useEffect(() => {
    debugLog('hls', 'HLSPlayer useEffect triggered', {
      camId,
      hasAuthToken: !!authToken,
      hasOnError: !!onError,
      hasOnPlaying: !!onPlaying
    })

    if (!camId) {
      debugLog('hls', 'no camId provided, exiting')
      return
    }

    let cancelled = false
    let statsInterval = null
    let latencyInterval = null

    const fail = (message) => {
      if (cancelled) return
      debugLog('hls', 'fail:', message)
      setFailedStage(stageRef.current)
      setStatus('error')
      setErrorMessage(message)
      if (onError) onError(message)
    }

    const cleanup = () => {
      cancelled = true
      if (statsInterval) {
        clearInterval(statsInterval)
        statsInterval = null
      }
      if (latencyInterval) {
        clearInterval(latencyInterval)
        latencyInterval = null
      }
      if (onLatencyRef.current) onLatencyRef.current(null)
      if (hlsRef.current) {
        debugLog('hls', 'destroying hls instance')
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.src = ''
      }
    }

    async function start() {
      const video = videoRef.current
      if (!video) {
        debugLog('hls', 'no video element reference')
        return
      }

      debugLog('hls', 'video element ready, starting player')

      const playlistUrl = hlsPlaylistUrl(camId, authToken)

      // Сначала проверяем нативную поддержку HLS (Safari) - hls.js не нужен
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Нативная поддержка HLS (Safari)
        debugLog('hls', 'using native HLS support (Safari)')
        try {
          video.src = playlistUrl
          debugLog('hls', 'set video source', { url: playlistUrl })

          video.addEventListener('loadstart', () => {
            if (cancelled) return
            debugLog('hls', 'native: loadstart event')
          })

          video.addEventListener('loadedmetadata', () => {
            if (cancelled) return
            bump(1)
            debugLog('hls', 'native: metadata loaded', {
              duration: video.duration,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight
            })
            video.play().catch((e) => {
              debugLog('hls', 'native: autoplay prevented', {
                error: e.message,
                name: e.name
              })
            })
          })

          video.addEventListener('canplay', () => {
            if (cancelled) return
            bump(2)
            debugLog('hls', 'native: canplay event')
          })

          video.addEventListener('playing', () => {
            if (cancelled) return
            debugLog('hls', 'native: playing event')
            bump(3)
            setStatus('playing')
            if (onPlaying) onPlaying()

            // Статистика для нативного HLS
            if (!statsInterval) {
              statsInterval = setInterval(() => {
                if (cancelled || !video) return
                const stats = {
                  currentTime: video.currentTime,
                  buffered: video.buffered.length > 0 ? {
                    start: video.buffered.start(0),
                    end: video.buffered.end(video.buffered.length - 1)
                  } : null,
                  paused: video.paused,
                  ended: video.ended,
                  readyState: video.readyState,
                  networkState: video.networkState
                }
                debugLog('hls', 'native: stats', stats)
              }, 5000)
            }
          })

          video.addEventListener('waiting', () => {
            if (cancelled) return
            debugLog('hls', 'native: waiting (buffering)')
          })

          video.addEventListener('stalled', () => {
            if (cancelled) return
            debugLog('hls', 'native: stalled')
          })

          video.addEventListener('error', () => {
            if (cancelled) return
            debugLog('hls', 'native: video error', {
              code: video.error?.code,
              message: video.error?.message,
              MEDIA_ERR_ABORTED: video.error?.code === 1,
              MEDIA_ERR_NETWORK: video.error?.code === 2,
              MEDIA_ERR_DECODE: video.error?.code === 3,
              MEDIA_ERR_SRC_NOT_SUPPORTED: video.error?.code === 4,
              readyState: video.readyState,
              networkState: video.networkState,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              currentTime: video.currentTime
            })
            if (DEBUG_LOGGING) diagnoseNativeHls(playlistUrl)
            fail('Ошибка воспроизведения HLS потока')
          })
        } catch (e) {
          debugLog('hls', 'native HLS error', {
            error: e.message,
            name: e.name,
            stack: e.stack
          })
          fail('Не удалось воспроизвести HLS поток')
        }
        return
      }

      // Нативной поддержки нет - загружаем hls.js динамически
      debugLog('hls', 'native HLS not supported, loading hls.js dynamically')
      let Hls
      try {
        const hlsModule = await import('hls.js')
        if (cancelled) return
        Hls = hlsModule.default
        debugLog('hls', 'hls.js loaded successfully', { isSupported: Hls.isSupported() })
      } catch (e) {
        debugLog('hls', 'failed to load hls.js', { error: e.message })
        fail('Не удалось загрузить HLS плеер')
        return
      }

      // Проверяем поддержку hls.js
      if (Hls.isSupported()) {
        debugLog('hls', 'starting player with hls.js', {
          playlistUrl,
          hasAuthToken: !!authToken
        })
        try {
          debugLog('hls', 'creating hls.js instance with config', {
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30,
            maxBufferLength: 30,
            maxMaxBufferLength: 60
          })

          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
          })
          hlsRef.current = hls

          // Задержка = серверное «сейчас» − время захвата кадра, который проигрывается.
          // Время кадра = timestamp сегмента (из имени) + смещение currentTime внутри сегмента.
          // Работает только в режиме hls.js: в нативном HLS (Safari/часть Android) нет события смены сегмента.
          let currentFrag = null
          ensureServerClock()
          hls.on(Hls.Events.FRAG_CHANGED, (event, data) => {
            const f = data?.frag
            const m = SEGMENT_RE.exec(f?.relurl || f?.url || '')
            currentFrag = m ? { ts: toEpochSeconds(Number(m[1])), start: f.start } : null
          })
          latencyInterval = setInterval(() => {
            if (cancelled || !onLatencyRef.current) return
            if (!currentFrag || !hasServerClock() || video.readyState < 2) return
            const captured = currentFrag.ts + (video.currentTime - currentFrag.start)
            const latency = Math.max(0, getServerNowSeconds() - captured)
            onLatencyRef.current(latency <= LATENCY_SANE_MAX_SECONDS ? latency : null)
          }, 500)

          debugLog('hls', 'loading source', { url: playlistUrl })
          hls.loadSource(playlistUrl)

          debugLog('hls', 'attaching media to video element')
          hls.attachMedia(video)

          hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            if (cancelled) return
            bump(1)
            debugLog('hls', 'manifest parsed', {
              levels: data.levels?.length,
              firstLevel: data.firstLevel,
              audioTracks: data.audioTracks?.length,
              subtitles: data.subtitleTracks?.length
            })
            video.play().catch((e) => {
              debugLog('hls', 'autoplay prevented', { error: e.message, name: e.name })
            })
          })

          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            if (cancelled) return
            debugLog('hls', 'media attached to video element')
          })

          hls.on(Hls.Events.LEVEL_LOADING, (event, data) => {
            if (cancelled) return
            debugLog('hls', 'level loading', {
              level: data.level,
              url: data.url
            })
          })

          hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
            if (cancelled) return
            debugLog('hls', 'level loaded', {
              level: data.level,
              details: {
                live: data.details?.live,
                targetduration: data.details?.targetduration,
                totalduration: data.details?.totalduration,
                fragments: data.details?.fragments?.length
              }
            })
          })

          hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
            if (cancelled) return
            debugLog('hls', 'fragment loading', {
              sn: data.frag?.sn,
              level: data.frag?.level,
              url: data.frag?.url
            })
          })

          hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
            if (cancelled) return
            bump(2)
            debugLog('hls', 'fragment loaded', {
              sn: data.frag?.sn,
              level: data.frag?.level,
              duration: data.frag?.duration,
              stats: {
                loaded: data.stats?.loaded,
                bwEstimate: data.stats?.bwEstimate
              }
            })
          })

          hls.on(Hls.Events.FRAG_PARSING_DATA, (event, data) => {
            if (cancelled) return
            debugLog('hls', 'fragment parsing data', {
              type: data.type,
              nb: data.nb,
              dropped: data.dropped
            })
          })

          hls.on(Hls.Events.BUFFER_APPENDING, (event, data) => {
            if (cancelled) return
            debugLog('hls', 'buffer appending', {
              type: data.type,
              size: data.data?.byteLength
            })
          })

          hls.on(Hls.Events.BUFFER_APPENDED, (event, data) => {
            if (cancelled) return
            debugLog('hls', 'buffer appended', {
              timeRanges: data.timeRanges
            })
          })

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (cancelled) return
            debugLog('hls', 'error event', {
              type: data.type,
              details: data.details,
              fatal: data.fatal,
              error: data.error?.message,
              reason: data.reason,
              response: data.response,
              url: data.url,
              context: data.context
            })
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  debugLog('hls', 'fatal network error - attempting recovery')
                  fail('Ошибка сети при загрузке HLS потока')
                  break
                case Hls.ErrorTypes.MEDIA_ERROR:
                  debugLog('hls', 'fatal media error - trying to recover')
                  try {
                    hls.recoverMediaError()
                    debugLog('hls', 'media error recovery initiated')
                  } catch (e) {
                    debugLog('hls', 'media error recovery failed', { error: e.message })
                    fail('Не удалось воспроизвести HLS поток')
                  }
                  break
                default:
                  debugLog('hls', 'fatal error - cannot recover', { type: data.type })
                  fail('Критическая ошибка HLS плеера')
                  break
              }
            }
          })

          video.addEventListener('loadstart', () => {
            if (cancelled) return
            debugLog('hls', 'video loadstart event')
          })

          video.addEventListener('loadedmetadata', () => {
            if (cancelled) return
            debugLog('hls', 'video metadata loaded', {
              duration: video.duration,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight
            })
          })

          video.addEventListener('canplay', () => {
            if (cancelled) return
            debugLog('hls', 'video canplay event')
          })

          video.addEventListener('playing', () => {
            if (cancelled) return
            debugLog('hls', 'video playing event')
            bump(3)
            setStatus('playing')
            if (onPlaying) onPlaying()

            // Запускаем периодический сбор статистики
            if (!statsInterval) {
              statsInterval = setInterval(() => {
                if (cancelled || !hls || !video) return
                const stats = {
                  currentTime: video.currentTime,
                  buffered: video.buffered.length > 0 ? {
                    start: video.buffered.start(0),
                    end: video.buffered.end(video.buffered.length - 1)
                  } : null,
                  paused: video.paused,
                  ended: video.ended,
                  readyState: video.readyState,
                  networkState: video.networkState,
                  hlsStats: {
                    currentLevel: hls.currentLevel,
                    loadLevel: hls.loadLevel,
                    nextLoadLevel: hls.nextLoadLevel,
                    bufferLength: hls.media?.buffered.length,
                    latency: hls.latency,
                    drift: hls.drift
                  }
                }
                debugLog('hls', 'stats', stats)
              }, 5000)
            }
          })

          video.addEventListener('waiting', () => {
            if (cancelled) return
            debugLog('hls', 'video waiting (buffering)')
          })

          video.addEventListener('stalled', () => {
            if (cancelled) return
            debugLog('hls', 'video stalled')
          })

          video.addEventListener('error', (e) => {
            if (cancelled) return
            debugLog('hls', 'video error event', {
              error: video.error?.code,
              message: video.error?.message
            })
          })

        } catch (e) {
          debugLog('hls', 'initialization error', {
            error: e.message,
            name: e.name,
            stack: e.stack
          })
          fail('Не удалось инициализировать HLS плеер')
        }
      } else {
        debugLog('hls', 'HLS not supported', {
          hlsJsSupported: false,
          nativeHlsSupported: video.canPlayType('application/vnd.apple.mpegurl')
        })
        fail('Браузер не поддерживает HLS')
      }
    }

    debugLog('hls', 'calling start() function')
    start()

    return cleanup
  }, [camId, authToken, onError, onPlaying, attempt])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />

      <StreamStages
        steps={HLS_STEPS}
        stage={stage}
        finished={status === 'playing'}
        error={status === 'error' ? errorMessage : null}
        failedStage={failedStage}
        onRetry={retry}
      />
    </div>
  )
}

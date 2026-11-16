import { useEffect, useRef, useState } from 'react'
import { webrtcWsUrl, getIceServers } from '../../api/streaming'
import { debugLog } from '../../utils/debugLog'
import { createWebrtcTrace, shortSdp, describeCandidate, maskUrl } from '../../utils/webrtcDebug'
import VideoControls from './VideoControls'
import StreamStages from './StreamStages'

// WebRTC player для ultra low latency стриминга
const WEBRTC_CONNECTION_TIMEOUT = 15000 // 15 секунд таймаут на соединение

// Реальные этапы подключения (индекс = stage):
// 0 — запрос стрима (ICE-серверы, создание WebSocket), 1 — сигналинг (WebSocket открыт, ждём offer/answer),
// 2 — ICE-соединение (answer отправлен, идёт установка соединения), 3 — получение видео (соединение
// установлено, ждём первый кадр), 4 — готово.
const WEBRTC_STEPS = ['Запрос стрима', 'Сигналинг (offer/answer)', 'ICE-соединение', 'Получение видео', 'Готово']

export default function WebRTCPlayer({ camId, authToken, onError, onPlaying }) {
  const videoRef = useRef(null)
  const pendingStreamRef = useRef(null)
  const [status, setStatus] = useState('connecting')
  const [errorMessage, setErrorMessage] = useState('')
  const [stage, setStage] = useState(0)
  const [failedStage, setFailedStage] = useState(null)
  const [firstFrame, setFirstFrame] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const stageRef = useRef(0)
  const traceRef = useRef(null) // отладочная трасса текущей попытки (WEBRTC_DEBUG)
  // Этап только растёт; ref нужен, чтобы зафиксировать упавший этап в fail().
  const bump = (n) => {
    if (n > stageRef.current) {
      stageRef.current = n
      setStage(n)
      traceRef.current?.stage(n, WEBRTC_STEPS[n])
    }
  }

  function retry() {
    if (videoRef.current) videoRef.current.srcObject = null
    stageRef.current = 0
    setStage(0)
    setFailedStage(null)
    setFirstFrame(false)
    setErrorMessage('')
    setStatus('connecting')
    setAttempt((a) => a + 1)
  }

  useEffect(() => {
    if (!camId) return

    let cancelled = false
    let ws = null
    let pc = null
    let connectionTimeout = null
    let trackReceived = false
    let connectionEstablished = false
    let statsInterval = null

    // Отладочная трасса таймингов (no-op, если WEBRTC_DEBUG выключен)
    const trace = createWebrtcTrace(`cam=${camId}`)
    traceRef.current = trace
    trace.log('старт попытки', { attempt, camId, формат: 'webrtc' })
    trace.stage(0, WEBRTC_STEPS[0])
    let tWsOpen = 0
    let firstMsgLogged = false
    let firstFrameLogged = false
    const videoEl = videoRef.current
    const videoEvents = ['loadedmetadata', 'loadeddata', 'playing', 'waiting', 'stalled', 'error']
    const onVideoEvent = (ev) => {
      if (cancelled) return
      if (ev.type === 'error') {
        const err = videoEl?.error
        trace.log('video: error', err ? { code: err.code, message: err.message } : undefined)
      } else {
        trace.log(`video: ${ev.type}`)
      }
      if (ev.type === 'playing' || ev.type === 'loadeddata') markFirstFrame('событие ' + ev.type)
    }
    function markFirstFrame(src) {
      if (firstFrameLogged) return
      firstFrameLogged = true
      trace.log('первый кадр', src)
      trace.stage(4, WEBRTC_STEPS[4])
      trace.summary()
    }
    if (trace.enabled && videoEl) {
      videoEvents.forEach((e) => videoEl.addEventListener(e, onVideoEvent))
      if (typeof videoEl.requestVideoFrameCallback === 'function') {
        videoEl.requestVideoFrameCallback(() => { if (!cancelled) markFirstFrame('requestVideoFrameCallback') })
      }
    }

    const checkReady = () => {
      if (trackReceived && connectionEstablished && !cancelled) {
        debugLog('webrtc', 'checkReady: both conditions met, setting status to playing')
        setStatus('playing')
        if (onPlaying) onPlaying()

        // Запускаем периодический сбор статистики
        if (pc && !statsInterval) {
          statsInterval = setInterval(async () => {
            if (cancelled || !pc) return
            try {
              const stats = await pc.getStats()
              const inboundStats = []
              stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                  inboundStats.push({
                    bytesReceived: report.bytesReceived,
                    packetsReceived: report.packetsReceived,
                    packetsLost: report.packetsLost,
                    framesReceived: report.framesReceived,
                    framesDecoded: report.framesDecoded,
                    framesDropped: report.framesDropped,
                    jitter: report.jitter
                  })
                }
              })
              if (inboundStats.length > 0) {
                debugLog('webrtc', 'stats', { inbound: inboundStats[0] })
              }
            } catch (e) {
              debugLog('webrtc', 'failed to get stats', { error: e.message })
            }
          }, 5000) // каждые 5 секунд
        }
      } else {
        debugLog('webrtc', 'checkReady: conditions not met', {
          trackReceived,
          connectionEstablished,
          cancelled
        })
      }
    }

    const fail = (message) => {
      if (cancelled) return
      debugLog('webrtc', 'fail:', message)
      trace.log('ОШИБКА (fail)', { этап: stageRef.current, причина: message, attempt })
      setFailedStage(stageRef.current)
      setStatus('error')
      setErrorMessage(message)
      if (onError) onError(message)
    }

    const cleanup = () => {
      trace.log('очистка попытки (cleanup)')
      if (trace.enabled && videoEl) videoEvents.forEach((e) => videoEl.removeEventListener(e, onVideoEvent))
      trace.end()
      if (traceRef.current === trace) traceRef.current = null
      cancelled = true
      if (connectionTimeout) {
        clearTimeout(connectionTimeout)
        connectionTimeout = null
      }
      if (statsInterval) {
        clearInterval(statsInterval)
        statsInterval = null
      }
      if (ws) {
        ws.close()
        ws = null
      }
      if (pc) {
        pc.close()
        pc = null
      }
    }

    async function start() {
      try {
        const wsUrl = webrtcWsUrl(camId, authToken)
        trace.log('запрос ICE-серверов: старт')
        const tIce = performance.now()
        const iceServers = await getIceServers(authToken)
        trace.log('запрос ICE-серверов: готово', {
          мс: Math.round(performance.now() - tIce),
          серверов: iceServers?.length,
          urls: (iceServers || []).map((x) => x.urls),
        })
        if (cancelled) return

        debugLog('webrtc', 'starting', { wsUrl, iceServers })
        debugLog('webrtc', 'creating peer connection', { iceServers })

        try {
          pc = new RTCPeerConnection({ iceServers })
        } catch (e) {
          debugLog('webrtc', 'RTCPeerConnection creation failed', {
            error: e.message,
            name: e.name,
            stack: e.stack
          })
          fail(`Ошибка создания RTCPeerConnection: ${e.message}`)
          return
        }

        trace.log('RTCPeerConnection создан')

        // Handle incoming video track
        pc.ontrack = (event) => {
          if (cancelled) return
          trace.log('ontrack', { kind: event.track?.kind, streams: event.streams.length })
          debugLog('webrtc', 'received track', {
            streams: event.streams.length,
            hasVideoRef: !!videoRef.current,
            hasStream: !!event.streams[0],
            trackReceived: trackReceived,
            connectionEstablished: connectionEstablished,
            connectionState: pc.connectionState,
            iceConnectionState: pc.iceConnectionState,
            iceGatheringState: pc.iceGatheringState,
            signalingState: pc.signalingState
          })

          if (event.streams[0]) {
            if (videoRef.current) {
              // videoRef уже готов — присваиваем сразу
              videoRef.current.srcObject = event.streams[0]
              trackReceived = true
              setStatus('negotiating')
              debugLog('webrtc', 'track assigned to video element immediately', {
                trackReceived,
                connectionEstablished,
                willCallOnPlaying: trackReceived && connectionEstablished
              })
              checkReady()
            } else {
              // videoRef ещё не готов — сохраняем стрим для присвоения позже
              pendingStreamRef.current = event.streams[0]
              trackReceived = true
              setStatus('negotiating')
              debugLog('webrtc', 'track saved as pending (videoRef not ready yet)', {
                trackReceived,
                connectionEstablished,
                willCallOnPlaying: trackReceived && connectionEstablished
              })
              checkReady()
            }
          } else {
            debugLog('webrtc', 'track event has no streams', { event })
          }
        }

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
          if (cancelled) return
          trace.log('connectionState', pc.connectionState)
          debugLog('webrtc', 'connection state changed', {
            state: pc.connectionState,
            iceConnectionState: pc.iceConnectionState,
            iceGatheringState: pc.iceGatheringState,
            signalingState: pc.signalingState,
            trackReceived: trackReceived,
            connectionEstablished: connectionEstablished
          })
          if (pc.connectionState === 'connected') {
            if (connectionTimeout) {
              clearTimeout(connectionTimeout)
              connectionTimeout = null
            }
            connectionEstablished = true
            bump(3)
            debugLog('webrtc', 'calling checkReady after connected', {
              trackReceived,
              connectionEstablished,
              willCallOnPlaying: trackReceived && connectionEstablished
            })
            checkReady()
          } else if (pc.connectionState === 'failed') {
            fail('WebRTC подключение не удалось')
          } else if (pc.connectionState === 'disconnected') {
            fail('WebRTC подключение разорвано')
          }
        }

        // Устанавливаем таймаут на соединение
        connectionTimeout = setTimeout(() => {
          if (cancelled) return
          if (pc.connectionState !== 'connected') {
            trace.log('ТАЙМАУТ соединения', { мс: WEBRTC_CONNECTION_TIMEOUT, connectionState: pc.connectionState, этап: stageRef.current })
            debugLog('webrtc', 'connection timeout', {
              state: pc.connectionState,
              timeout: WEBRTC_CONNECTION_TIMEOUT
            })
            fail('Превышено время ожидания WebRTC соединения')
          }
        }, WEBRTC_CONNECTION_TIMEOUT)

        debugLog('webrtc', 'connecting to signaling server', { wsUrl })

        try {
          trace.log('создание WebSocket', maskUrl(wsUrl))
          ws = new WebSocket(wsUrl)
        } catch (e) {
          trace.log('WebSocket: исключение при создании', e.message)
          debugLog('webrtc', 'WebSocket creation failed', {
            error: e.message,
            name: e.name,
            stack: e.stack,
            wsUrl
          })
          fail(`Ошибка создания WebSocket: ${e.message}`)
          return
        }

        ws.onopen = () => {
          if (cancelled) return
          debugLog('webrtc', 'websocket connected')
          tWsOpen = performance.now()
          trace.log('ws.onopen')
          bump(1)
          setStatus('negotiating')
        }

        ws.onmessage = async (event) => {
          if (cancelled) return
          try {
            const msg = JSON.parse(event.data)
            if (trace.enabled) {
              if (!firstMsgLogged) {
                firstMsgLogged = true
                trace.log('ожидание первого сообщения от сервера (после ws.onopen)', { мс: Math.round(performance.now() - tWsOpen) })
              }
              const brief = msg.type === 'offer' || msg.type === 'answer'
                ? shortSdp(msg.sdp)
                : msg.type === 'ice_candidate' || msg.type === 'candidate'
                  ? String(msg.candidate || '').slice(0, 200)
                  : JSON.stringify(msg).slice(0, 200)
              trace.log(`ws сообщение <- ${msg.type}`, brief)
            }
            debugLog('webrtc', 'received message', { type: msg.type, msg })

            if (msg.type === 'offer') {
              // Server sends offer first (server-side offer protocol)
              debugLog('webrtc', 'received offer from server, creating answer')
              try {
                let t = performance.now()
                trace.log('setRemoteDescription(offer): старт')
                await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp })
                trace.log('setRemoteDescription(offer): готово', { мс: Math.round(performance.now() - t) })
                debugLog('webrtc', 'remote description (offer) set successfully')

                t = performance.now()
                trace.log('createAnswer: старт')
                const answer = await pc.createAnswer()
                trace.log('createAnswer: готово', { мс: Math.round(performance.now() - t) })
                t = performance.now()
                trace.log('setLocalDescription(answer): старт')
                await pc.setLocalDescription(answer)
                trace.log('setLocalDescription(answer): готово', { мс: Math.round(performance.now() - t) })
                debugLog('webrtc', 'sending answer to server')
                bump(2)

                ws.send(JSON.stringify({
                  type: 'answer',
                  sdp: answer.sdp
                }))
                trace.log('ws сообщение -> answer', shortSdp(answer.sdp))
              } catch (e) {
                debugLog('webrtc', 'answer creation failed', {
                  error: e.message,
                  name: e.name,
                  stack: e.stack
                })
                fail(`Ошибка создания answer: ${e.message}`)
              }
            } else if (msg.type === 'error') {
              debugLog('webrtc', 'server error received', { message: msg.message })
              fail(`Ошибка сервера: ${msg.message}`)
            }
          } catch (e) {
            debugLog('webrtc', 'error handling message', {
              error: e.message,
              name: e.name,
              stack: e.stack,
              data: event.data
            })
            fail(`Ошибка обработки сигналов WebRTC: ${e.message}`)
          }
        }

        ws.onerror = (error) => {
          if (cancelled) return
          trace.log('ws.onerror', { readyState: ws?.readyState })
          debugLog('webrtc', 'websocket error', {
            error,
            readyState: ws?.readyState,
            url: ws?.url
          })
          fail('Ошибка WebSocket соединения')
        }

        ws.onclose = (event) => {
          trace.log('ws.onclose', { code: event.code, reason: event.reason, wasClean: event.wasClean, cancelled })
          if (cancelled) return
          debugLog('webrtc', 'websocket closed', { code: event.code })
          if (event.code === 1008) {
            fail('Ошибка авторизации или WebRTC отключен')
          } else if (status !== 'playing' && status !== 'error') {
            fail('Соединение закрыто')
          }
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (cancelled) return
          trace.log(event.candidate ? 'локальный ICE-кандидат' : 'сбор ICE-кандидатов завершён', describeCandidate(event.candidate))
          if (!ws || ws.readyState !== WebSocket.OPEN) return
          if (event.candidate) {
            debugLog('webrtc', 'sending ice candidate', {
              candidate: event.candidate.candidate,
              type: event.candidate.type,
              protocol: event.candidate.protocol,
              address: event.candidate.address,
              port: event.candidate.port,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex
            })
            ws.send(JSON.stringify({
              type: 'ice_candidate',
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex
            }))
            trace.log('ws сообщение -> ice_candidate')
          } else {
            debugLog('webrtc', 'ice gathering complete')
          }
        }

        // ICE connection state changes
        pc.oniceconnectionstatechange = () => {
          if (cancelled) return
          trace.log('iceConnectionState', pc.iceConnectionState)
          debugLog('webrtc', 'ice connection state changed', {
            iceConnectionState: pc.iceConnectionState,
            connectionState: pc.connectionState
          })
        }

        // ICE gathering state changes
        pc.onicegatheringstatechange = () => {
          if (cancelled) return
          trace.log('iceGatheringState', pc.iceGatheringState)
          debugLog('webrtc', 'ice gathering state changed', {
            iceGatheringState: pc.iceGatheringState
          })
        }

        // Signaling state changes
        pc.onsignalingstatechange = () => {
          if (cancelled) return
          trace.log('signalingState', pc.signalingState)
          debugLog('webrtc', 'signaling state changed', {
            signalingState: pc.signalingState
          })
        }

      } catch (e) {
        trace.log('исключение инициализации', e.message)
        debugLog('webrtc', 'initialization error', {
          error: e.message,
          name: e.name,
          stack: e.stack,
          fullError: e
        })
        fail(`Не удалось инициализировать WebRTC: ${e.message}`)
      }
    }

    start()

    return cleanup
  }, [camId, authToken, onError, onPlaying, attempt])

  // Отдельный эффект для присвоения pendingStream когда videoRef становится доступен
  useEffect(() => {
    if (videoRef.current && pendingStreamRef.current) {
      debugLog('webrtc', 'assigning pending stream to video element', {
        hadPendingStream: !!pendingStreamRef.current
      })
      videoRef.current.srcObject = pendingStreamRef.current
      pendingStreamRef.current = null
    }
  })

  const playing = status === 'playing'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onPlaying={() => setFirstFrame(true)}
        onLoadedData={() => setFirstFrame(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
      {playing && <VideoControls videoRef={videoRef} />}
      <StreamStages
        steps={WEBRTC_STEPS}
        stage={stage}
        finished={playing && firstFrame}
        error={status === 'error' ? errorMessage : null}
        failedStage={failedStage}
        onRetry={retry}
      />
    </div>
  )
}

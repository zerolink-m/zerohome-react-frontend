import { useEffect, useRef, useState } from 'react'
import { streamUrl, streamAuthHeaders } from '../../api/cams'
import { colors } from '../../styles/tokens'
import { debugLog, bytesToHex, bytesToAscii } from '../../utils/debugLog'
import {
  findBox,
  iterBoxes,
  readBoxType,
  concatChunks,
  dumpTopLevelBoxes,
  parseMoof,
  findNextMdat,
  takeSegment,
  buildAacAudioSpecificConfig,
  findAudioParams,
} from '../../utils/fmp4'

const MAX_INIT_BYTES = 2 * 1024 * 1024
const BUFFER_WINDOW_SECONDS = 30
const LIVE_EDGE_MAX_LAG = 2
const LIVE_EDGE_TARGET = 0.5
const MAX_VIDEO_FRAME_QUEUE = 12

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

function findVideoAvcC(buf, moov) {
  for (const trak of iterBoxes(buf, moov.bodyStart, moov.end)) {
    if (trak.type !== 'trak') continue
    const mdia = findBox(buf, trak.bodyStart, trak.end, 'mdia')
    if (!mdia) continue
    const hdlr = findBox(buf, mdia.bodyStart, mdia.end, 'hdlr')
    if (!hdlr) continue
    // FullBox(hdlr): version+flags(4) + pre_defined(4) + handler_type(4)
    const handlerType = readBoxType(buf, hdlr.bodyStart + 8)
    if (handlerType !== 'vide') continue
    const minf = findBox(buf, mdia.bodyStart, mdia.end, 'minf')
    const stbl = minf && findBox(buf, minf.bodyStart, minf.end, 'stbl')
    const stsd = stbl && findBox(buf, stbl.bodyStart, stbl.end, 'stsd')
    if (!stsd) continue
    // stsd: version+flags(4) + entry_count(4), затем sample entries (сами оформлены как боксы)
    const avc1 = findBox(buf, stsd.bodyStart + 8, stsd.end, 'avc1')
    if (!avc1) continue
    // VisualSampleEntry: 78 фиксированных байт полей перед дочерними боксами
    const avcC = findBox(buf, avc1.bodyStart + 78, avc1.end, 'avcC')
    if (avcC) return buf.slice(avcC.bodyStart, avcC.end)
  }
  return null
}

function avcCodecString(avcCBytes) {
  const hex = (n) => n.toString(16).padStart(2, '0')
  return `avc1.${hex(avcCBytes[1])}${hex(avcCBytes[2])}${hex(avcCBytes[3])}`
}

// Возвращает доступный API полноэкранного режима для текущей комбинации
// (стандартный / iOS-video для <video>-элемента / нет). На iOS Safari нет
// Element.requestFullscreen, но webkitEnterFullscreen работает для <video>
// в MSE-режиме. В WebCodecs (canvas) на iOS полного экрана нет.
function getFullscreenApi(container, video, playbackMode) {
  if (document.fullscreenEnabled && container?.requestFullscreen) {
    return { mode: 'standard' }
  }
  if (playbackMode === 'mse' && video?.webkitEnterFullscreen) {
    return { mode: 'ios-video' }
  }
  return null
}

// Проигрывание fragmented-mp4 потока (GET /v1/cams/{id}/stream) через fetch
// (<video src> не может передать заголовок Authorization). Два пути
// воспроизведения, выбираются один раз при старте по возможностям браузера:
// - MediaSource Extensions (приоритетный) — браузер сам разбирает moof/mdat,
//   декодирует и синхронизирует A/V, мы просто перекладываем байты в SourceBuffer.
// - WebCodecs + canvas (fallback) — для браузеров без полноценного MediaSource
//   для <video> (iOS/iPadOS Safari): сами вычленяем сэмплы из moof/mdat
//   (fmp4.js: parseMoof/findNextMdat) и кормим их в VideoDecoder/AudioDecoder,
//   конфигурируя декодер прямо из avcC (без ожидания in-band SPS/PPS — сервер
//   их больше не шлёт, конфиг только в moov). Аудио — AAC-LC 8000Hz моно,
//   считаем фиксированным (см. buildAacAudioSpecificConfig).
export default function VideoStream({ camId, authToken, children }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const gainNodeRef = useRef(null)
  const [status, setStatus] = useState('connecting')
  const [errorMessage, setErrorMessage] = useState('')
  const [muted, setMuted] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [playbackMode, setPlaybackMode] = useState(null)

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    const video = videoRef.current
    // iOS Safari: у <video> есть свои события начала/окончания полного экрана.
    function onIosBegin() { setIsFullscreen(true) }
    function onIosEnd() { setIsFullscreen(false) }
    if (video) {
      video.addEventListener('webkitbeginfullscreen', onIosBegin)
      video.addEventListener('webkitendfullscreen', onIosEnd)
    }
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', onIosBegin)
        video.removeEventListener('webkitendfullscreen', onIosEnd)
      }
    }
  }, [])

  // Screen Wake Lock — не даём экрану гаснуть, пока стрим смонтирован.
  // Автоматически освобождается при unmount; переоформляется при возврате во вкладку.
  useEffect(() => {
    let wakeLock = null
    let cancelled = false
    async function acquire() {
      if (!('wakeLock' in navigator)) return
      try {
        const wl = await navigator.wakeLock.request('screen')
        if (cancelled) {
          try { await wl.release() } catch { /* ignore */ }
          return
        }
        wakeLock = wl
        wl.addEventListener('release', () => { wakeLock = null })
      } catch {
        // Обычно из-за того, что вкладка не в фокусе — попытаемся снова по visibilitychange.
      }
    }
    function onVisibility() {
      if (document.visibilityState === 'visible' && !wakeLock) acquire()
    }
    acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      if (wakeLock) wakeLock.release().catch(() => {})
      wakeLock = null
    }
  }, [])

  function toggleFullscreen() {
    const api = getFullscreenApi(containerRef.current, videoRef.current, playbackMode)
    if (!api) return
    if (api.mode === 'standard') {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      } else {
        containerRef.current?.requestFullscreen().catch(() => {})
      }
      return
    }
    if (api.mode === 'ios-video') {
      // На iOS нет программного exit — пользователь выходит встроенным контролом.
      try { videoRef.current.webkitEnterFullscreen() } catch { /* ignore */ }
    }
  }

  useEffect(() => {
    if (playbackMode === 'mse' && videoRef.current) videoRef.current.muted = muted
    if (playbackMode === 'webcodecs' && gainNodeRef.current) gainNodeRef.current.gain.value = muted ? 0 : 1
  }, [muted, playbackMode])

  useEffect(() => {
    if (!camId) return
    const video = videoRef.current
    let cancelled = false
    let markedPlaying = false
    const controller = new AbortController()
    let reader = null

    // --- MediaSource ---
    let mediaSource = null
    let sourceBuffer = null
    let objectUrl = null
    const appendQueue = []

    // --- WebCodecs fallback ---
    let videoDecoder = null
    let audioDecoder = null
    let audioContext = null
    let gainNode = null
    let rafId = null
    const frameQueue = []
    let awaitingKeyframe = true
    let videoSampleCounter = 0
    let audioSampleCounter = 0
    let nextAudioTime = 0

    setStatus('connecting')
    setErrorMessage('')
    setPlaybackMode(null)

    function fail(message) {
      if (cancelled) return
      debugLog('stream', 'fail:', message)
      setStatus('error')
      setErrorMessage(message)
      cancelled = true
      controller.abort()
      if (reader) reader.cancel().catch(() => {})
    }

    function maybeMarkPlaying() {
      if (!markedPlaying && !cancelled) {
        markedPlaying = true
        setStatus('playing')
      }
    }

    // ---------- MediaSource ----------

    function enqueue(bytes) {
      appendQueue.push(bytes)
      drainQueue()
    }

    function drainQueue() {
      if (!sourceBuffer || sourceBuffer.updating || !appendQueue.length) return
      try {
        sourceBuffer.appendBuffer(appendQueue.shift())
      } catch (e) {
        debugLog('mse', 'appendBuffer выбросил исключение', e)
        fail('Ошибка воспроизведения видеопотока')
      }
    }

    function trimBuffer() {
      if (!sourceBuffer || sourceBuffer.updating || !sourceBuffer.buffered.length) return
      const start = sourceBuffer.buffered.start(0)
      const end = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1)
      if (end - start > BUFFER_WINDOW_SECONDS) {
        try {
          sourceBuffer.remove(start, end - BUFFER_WINDOW_SECONDS)
        } catch (e) {
          debugLog('mse', 'sourceBuffer.remove выбросил исключение', e)
        }
      }
    }

    function handleUpdateEnd() {
      if (cancelled) return
      trimBuffer()
      drainQueue()
    }

    function catchUpToLiveEdge() {
      if (!video || !video.buffered.length) return
      const end = video.buffered.end(video.buffered.length - 1)
      if (end - video.currentTime > LIVE_EDGE_MAX_LAG) {
        debugLog('mse', 'отставание от живого края, перематываем', { end, currentTime: video.currentTime })
        video.currentTime = Math.max(0, end - LIVE_EDGE_TARGET)
      }
    }

    function handleVideoError() {
      if (cancelled) return
      debugLog('mse', 'video error', video?.error)
      fail('Ошибка воспроизведения видеопотока')
    }

    async function startMse(initSegment, leftover, mimeCodec) {
      mediaSource = new MediaSource()
      objectUrl = URL.createObjectURL(mediaSource)
      video.src = objectUrl

      await new Promise((resolve) => mediaSource.addEventListener('sourceopen', resolve, { once: true }))
      if (cancelled) return

      try {
        sourceBuffer = mediaSource.addSourceBuffer(mimeCodec)
        sourceBuffer.mode = 'sequence'
        sourceBuffer.addEventListener('updateend', handleUpdateEnd)
      } catch (e) {
        debugLog('mse', 'addSourceBuffer выбросил исключение', e)
        fail('Браузер не поддерживает воспроизведение этого потока')
        return
      }

      enqueue(initSegment)
      video.play().catch(() => {})

      // Дальше всё идёт через кадрирование: и хвост init-буфера, и каждый
      // прочитанный чанк — это байты произвольной длины (границы сетевых
      // чанков), а appendBuffer принимает только целые сегменты. Отдаём то,
      // что уже сложилось в сегмент, остаток придерживаем до следующего чтения.
      let pending = leftover
      while (!cancelled) {
        for (;;) {
          const framed = takeSegment(pending)
          if (!framed) break
          enqueue(framed.segment)
          pending = framed.rest
        }

        let chunk
        try {
          chunk = await reader.read()
        } catch (e) {
          debugLog('stream', 'ошибка чтения потока', e)
          fail('Соединение с потоком прервано')
          return
        }
        if (chunk.done) {
          debugLog('stream', 'поток завершён (done)')
          fail('Соединение с потоком прервано')
          return
        }
        debugLog('stream', 'чанк получен', { bytes: chunk.value.length, pending: pending.length })
        pending = concatChunks([pending, chunk.value], pending.length + chunk.value.length)
      }
    }

    // ---------- WebCodecs fallback ----------

    function drawFrame(frame) {
      const canvas = canvasRef.current
      if (!canvas) return
      if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
        canvas.width = frame.displayWidth
        canvas.height = frame.displayHeight
      }
      const ctx = canvas.getContext('2d')
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
    }

    function renderTick() {
      if (cancelled) return
      if (frameQueue.length) {
        const frame = frameQueue.shift()
        drawFrame(frame)
        frame.close()
        maybeMarkPlaying()
      }
      rafId = requestAnimationFrame(renderTick)
    }

    function handleVideoFrame(frame) {
      frameQueue.push(frame)
      if (frameQueue.length > MAX_VIDEO_FRAME_QUEUE) {
        // отстаём от живого края — отбрасываем самый старый кадр
        frameQueue.shift().close()
      }
    }

    function handleAudioFrame(audioData) {
      if (!audioContext) {
        audioData.close()
        return
      }
      const numChannels = audioData.numberOfChannels
      const numFrames = audioData.numberOfFrames
      const audioBuffer = audioContext.createBuffer(numChannels, numFrames, audioData.sampleRate)
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = new Float32Array(numFrames)
        audioData.copyTo(channelData, { planeIndex: ch })
        audioBuffer.copyToChannel(channelData, ch)
      }
      audioData.close()
      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(gainNode)
      const now = audioContext.currentTime
      if (nextAudioTime < now) nextAudioTime = now + 0.05
      source.start(nextAudioTime)
      nextAudioTime += audioBuffer.duration
    }

    function handleVideoSample(bytes, keyframe) {
      const isKey = keyframe != null ? keyframe : awaitingKeyframe
      if (awaitingKeyframe && !isKey) return

      // Логируем первые несколько сэмплов для диагностики
      if (videoSampleCounter < 3) {
        debugLog('webcodecs', 'decoding video sample', {
          sampleNum: videoSampleCounter,
          isKey,
          awaitingKeyframe,
          bytesLength: bytes.length,
          first16Bytes: bytesToHex(bytes.slice(0, 16)),
        })
      }

      awaitingKeyframe = false
      try {
        videoDecoder.decode(
          new EncodedVideoChunk({
            type: isKey ? 'key' : 'delta',
            timestamp: videoSampleCounter++ * 1000,
            data: bytes,
          }),
        )
      } catch (e) {
        debugLog('webcodecs', 'videoDecoder.decode выбросил исключение', {
          message: e.message,
          name: e.name,
          sampleNum: videoSampleCounter - 1,
          isKey,
          bytesLength: bytes.length,
        })
      }
    }

    function handleAudioSample(bytes) {
      try {
        audioDecoder.decode(
          new EncodedAudioChunk({
            type: 'key',
            timestamp: audioSampleCounter++ * 1000,
            data: bytes,
          }),
        )
      } catch (e) {
        debugLog('webcodecs', 'audioDecoder.decode выбросил исключение', e)
      }
    }

    function handleFragment(buf, parsedMoof) {
      // Логируем первый фрагмент для диагностики
      if (videoSampleCounter === 0 && audioSampleCounter === 0) {
        debugLog('webcodecs', 'first fragment', {
          tracks: Array.from(parsedMoof.tracks.keys()),
          trackDetails: Array.from(parsedMoof.tracks.entries()).map(([trackId, track]) => ({
            trackId,
            sampleCount: track.sampleRanges.length,
            firstSampleKeyframe: track.sampleRanges[0]?.keyframe,
            firstSampleSize: track.sampleRanges[0] ? track.sampleRanges[0].end - track.sampleRanges[0].start : 0,
          })),
        })
      }

      for (const [trackId, track] of parsedMoof.tracks) {
        for (const range of track.sampleRanges) {
          const bytes = buf.slice(range.start, range.end)
          if (trackId === 1) handleVideoSample(bytes, range.keyframe)
          else if (trackId === 2) handleAudioSample(bytes)
        }
      }
    }

    async function startWebCodecs(initBuffer, moovEnd, avcC, codecString, moovBox) {
      // Извлекаем параметры аудио из moov
      const audioParams = findAudioParams(initBuffer, moovBox)
      debugLog('webcodecs', 'audio params from moov', audioParams)

      // Проверяем поддержку кодека
      let isCodecSupported = false
      try {
        const support = await VideoDecoder.isConfigurationSupported({
          codec: codecString,
          description: avcC,
        })
        isCodecSupported = support.supported
        debugLog('webcodecs', 'codec support check', {
          codec: codecString,
          supported: support.supported,
          config: support.config,
        })
      } catch (e) {
        debugLog('webcodecs', 'codec support check failed', {
          codec: codecString,
          error: e.message,
        })
      }

      if (!isCodecSupported) {
        debugLog('webcodecs', 'codec not supported, trying anyway', { codec: codecString })
      }

      videoDecoder = new VideoDecoder({
        output: handleVideoFrame,
        error: (e) => {
          debugLog('webcodecs', 'video decoder error', {
            message: e.message,
            name: e.name,
            code: e.code,
            error: e,
            stack: e.stack,
            codecString,
            avcCLength: avcC?.length,
          })
          fail('Ошибка воспроизведения видеопотока: кодек не поддерживается устройством')
        },
      })
      debugLog('webcodecs', 'configuring video decoder', {
        codec: codecString,
        descriptionLength: avcC.length,
        avcCHex: bytesToHex(avcC),
      })
      try {
        videoDecoder.configure({ codec: codecString, description: avcC })
        debugLog('webcodecs', 'video decoder configured successfully')
      } catch (e) {
        debugLog('webcodecs', 'video decoder configure failed', {
          message: e.message,
          name: e.name,
          error: e,
        })
        fail('Не удалось настроить декодер видео: кодек не поддерживается')
        return
      }

      audioContext = new (window.AudioContext || window.webkitAudioContext)()
      gainNode = audioContext.createGain()
      gainNode.gain.value = muted ? 0 : 1
      gainNode.connect(audioContext.destination)
      gainNodeRef.current = gainNode

      audioDecoder = new AudioDecoder({
        output: handleAudioFrame,
        error: (e) => {
          debugLog('webcodecs', 'audio decoder error', {
            message: e.message,
            name: e.name,
            code: e.code,
            error: e,
            stack: e.stack,
          })
          fail('Ошибка воспроизведения аудио')
        },
      })
      debugLog('webcodecs', 'configuring audio decoder', {
        codec: 'mp4a.40.2',
        sampleRate: audioParams.sampleRate,
        numberOfChannels: audioParams.numberOfChannels,
      })
      try {
        audioDecoder.configure({
          codec: 'mp4a.40.2',
          sampleRate: audioParams.sampleRate,
          numberOfChannels: audioParams.numberOfChannels,
          description: buildAacAudioSpecificConfig({
            objectType: 2,
            sampleRate: audioParams.sampleRate,
            channelConfig: audioParams.numberOfChannels
          }),
        })
        debugLog('webcodecs', 'audio decoder configured successfully')
      } catch (e) {
        debugLog('webcodecs', 'audio decoder configure failed', {
          message: e.message,
          name: e.name,
          error: e,
        })
        fail('Не удалось настроить декодер аудио')
        return
      }

      rafId = requestAnimationFrame(renderTick)

      let workBuffer = initBuffer
      let cursor = moovEnd
      while (!cancelled) {
        let progressed = true
        while (progressed) {
          progressed = false
          const moofBox = findBox(workBuffer, cursor, workBuffer.length, 'moof')
          if (!moofBox) break
          const mdatResult = findNextMdat(workBuffer, moofBox.end, workBuffer.length)
          if (!mdatResult) break
          const parsedMoof = parseMoof(workBuffer, moofBox)
          handleFragment(workBuffer, parsedMoof)
          cursor = mdatResult.mdat.end
          progressed = true
        }
        if (cursor > 0) {
          workBuffer = workBuffer.slice(cursor)
          cursor = 0
        }
        let chunk
        try {
          chunk = await reader.read()
        } catch (e) {
          debugLog('stream', 'ошибка чтения потока', e)
          fail('Соединение с потоком прервано')
          return
        }
        if (chunk.done) {
          debugLog('stream', 'поток завершён (done)')
          fail('Соединение с потоком прервано')
          return
        }
        workBuffer = concatChunks([workBuffer, chunk.value], workBuffer.length + chunk.value.length)
      }
    }

    // ---------- общий старт ----------

    async function start() {
      debugLog('stream', 'старт', { camId, url: streamUrl(camId) })

      let res
      try {
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : streamAuthHeaders()
        res = await fetch(streamUrl(camId), { headers, signal: controller.signal })
      } catch (e) {
        debugLog('stream', 'fetch завершился с ошибкой', e)
        if (!cancelled) fail('Не удалось подключиться к потоку')
        return
      }
      if (cancelled) return

      const contentType = res.headers.get('content-type') || ''
      debugLog('stream', 'ответ получен', { status: res.status, contentType, headers: [...res.headers.entries()] })

      if (!contentType.startsWith('video/')) {
        const json = await res.json().catch(() => null)
        debugLog('stream', 'content-type не video/*, тело ответа как JSON', json)
        if (!cancelled) fail(json?.error || 'Не удалось запустить видеопоток')
        return
      }

      reader = res.body.getReader()

      // Фаза 1: копим байты, пока не придут целиком ftyp и moov. Сервер отдаёт
      // init segment первым каждому подключению, но он может приехать не одним
      // чанком, поэтому накапливаем. Проверка "после ftyp сразу moof" ниже —
      // защита на случай сервера, который init segment не отдал.
      let initBuffer = new Uint8Array(0)
      let ftypBox = null
      let moovBox = null
      while (!cancelled && !moovBox) {
        let chunk
        try {
          chunk = await reader.read()
        } catch (e) {
          debugLog('stream', 'ошибка чтения потока (init)', e)
          fail('Соединение с потоком прервано')
          return
        }
        if (chunk.done) {
          debugLog('stream', 'поток завершён до получения moov')
          fail('Поток завершился раньше инициализации')
          return
        }
        initBuffer = concatChunks([initBuffer, chunk.value], initBuffer.length + chunk.value.length)
        if (!ftypBox) ftypBox = findBox(initBuffer, 0, initBuffer.length, 'ftyp')

        // После ftyp может быть либо moov, либо сразу moof (если сервер не отдал init segment)
        if (ftypBox) {
          moovBox = findBox(initBuffer, ftypBox.end, initBuffer.length, 'moov')

          // Если после ftyp сразу идёт moof - это подключение к уже идущему стриму без init segment
          if (!moovBox) {
            const moofAfterFtyp = findBox(initBuffer, ftypBox.end, initBuffer.length, 'moof')
            if (moofAfterFtyp) {
              debugLog('stream', 'после ftyp сразу идёт moof (без moov) - поток без init segment', {
                bufferedBytes: initBuffer.length,
                ftypEnd: ftypBox.end,
                moofStart: moofAfterFtyp.start,
                topLevelBoxes: dumpTopLevelBoxes(initBuffer),
              })
              fail('Сервер не отдал инициализацию потока. Обновите страницу или переподключитесь.')
              return
            }
          }
        }

        if (!moovBox && initBuffer.length > MAX_INIT_BYTES) {
          debugLog('stream', 'ftyp/moov не найдены после буферизации', {
            bufferedBytes: initBuffer.length,
            topLevelBoxes: dumpTopLevelBoxes(initBuffer),
            first64Hex: bytesToHex(initBuffer, 0, Math.min(64, initBuffer.length)),
            first64Ascii: bytesToAscii(initBuffer, 0, Math.min(64, initBuffer.length)),
          })
          fail('Некорректный формат потока (не найден moov)')
          return
        }
      }
      if (cancelled) return
      debugLog('stream', 'moov найден', { ftypEnd: ftypBox.end, moovStart: moovBox.start, moovEnd: moovBox.end })

      const avcC = findVideoAvcC(initBuffer, moovBox)
      if (!avcC) {
        fail('Не удалось определить параметры видео потока')
        return
      }
      const codecString = avcCodecString(avcC)
      const mimeCodec = `video/mp4; codecs="${codecString},mp4a.40.2"`
      debugLog('mse', 'codec-строка собрана', { codecString, avcCHex: bytesToHex(avcC) })

      const mseSupported =
        typeof window.MediaSource !== 'undefined' && window.MediaSource.isTypeSupported(mimeCodec)

      if (mseSupported) {
        debugLog('stream', 'выбран путь воспроизведения', { playbackMode: 'mse' })
        setPlaybackMode('mse')
        // В SourceBuffer init segment идёт отдельным append и обязан
        // заканчиваться на границе сегмента, поэтому обрезаем ровно по moov;
        // хвост буфера — уже начало медиа-сегмента, отдаём его следом.
        await startMse(
          initBuffer.slice(0, moovBox.end),
          initBuffer.slice(moovBox.end),
          mimeCodec,
        )
        return
      }

      if (typeof window.VideoDecoder !== 'undefined' && typeof window.AudioDecoder !== 'undefined') {
        // Проверяем поддержку конкретного кодека (если метод доступен)
        let codecSupported = true // По умолчанию пробуем

        if (typeof VideoDecoder.isConfigurationSupported === 'function') {
          try {
            const videoSupport = await VideoDecoder.isConfigurationSupported({
              codec: codecString,
              description: avcC,
            })
            codecSupported = videoSupport.supported
            debugLog('stream', 'проверка поддержки кодека WebCodecs', {
              codec: codecString,
              supported: codecSupported,
            })
          } catch (e) {
            debugLog('stream', 'ошибка проверки поддержки кодека', { error: e.message })
            // При ошибке проверки - пробуем декодировать
            codecSupported = true
          }
        } else {
          debugLog('stream', 'isConfigurationSupported недоступен, пробуем декодировать напрямую', {
            codec: codecString,
          })
        }

        if (codecSupported) {
          debugLog('stream', 'выбран путь воспроизведения', { playbackMode: 'webcodecs' })
          setPlaybackMode('webcodecs')
          await startWebCodecs(initBuffer, moovBox.end, avcC, codecString, moovBox)
          return
        }

        // Кодек точно не поддерживается
        debugLog('stream', 'WebCodecs не поддерживает кодек', {
          codec: codecString,
          message: 'Это устройство не поддерживает параметры видео данной камеры',
        })

        fail(
          `Кодек ${codecString} не поддерживается этим устройством.\n\n` +
          `Рекомендации:\n` +
          `1. Измените настройки камеры на H.264 Main Profile Level 4.0\n` +
          `2. Используйте компьютер (там работает MSE)\n` +
          `3. Обратитесь к администратору`
        )
        return
      }

      debugLog('stream', 'ни MediaSource, ни WebCodecs недоступны')
      fail('Браузер не поддерживает воспроизведение этого потока')
    }

    function cleanup() {
      debugLog('stream', 'unmount / смена camId, останавливаем поток', { camId })
      cancelled = true
      controller.abort()
      if (reader) reader.cancel().catch(() => {})

      if (sourceBuffer) {
        try {
          sourceBuffer.removeEventListener('updateend', handleUpdateEnd)
        } catch (e) {
          // источник уже отвязан — игнорируем
        }
      }
      try {
        if (mediaSource && mediaSource.readyState === 'open') mediaSource.endOfStream()
      } catch (e) {
        debugLog('mse', 'ошибка при endOfStream', e)
      }
      if (video) {
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl)

      if (rafId != null) cancelAnimationFrame(rafId)
      frameQueue.forEach((frame) => frame.close())
      frameQueue.length = 0
      try {
        if (videoDecoder && videoDecoder.state !== 'closed') videoDecoder.close()
      } catch (e) {
        debugLog('webcodecs', 'ошибка при закрытии videoDecoder', e)
      }
      try {
        if (audioDecoder && audioDecoder.state !== 'closed') audioDecoder.close()
      } catch (e) {
        debugLog('webcodecs', 'ошибка при закрытии audioDecoder', e)
      }
      try {
        if (audioContext && audioContext.state !== 'closed') audioContext.close()
      } catch (e) {
        debugLog('webcodecs', 'ошибка при закрытии audioContext', e)
      }
      gainNodeRef.current = null
    }

    video.addEventListener('playing', maybeMarkPlaying)
    video.addEventListener('error', handleVideoError)
    video.addEventListener('timeupdate', catchUpToLiveEdge)

    start()

    return () => {
      video.removeEventListener('playing', maybeMarkPlaying)
      video.removeEventListener('error', handleVideoError)
      video.removeEventListener('timeupdate', catchUpToLiveEdge)
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camId, authToken])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        background: '#000',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        {...{ 'webkit-playsinline': 'true' }}
        style={{
          width: '100%',
          height: '100%',
          display: playbackMode === 'webcodecs' ? 'none' : 'block',
          objectFit: 'contain',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: playbackMode === 'webcodecs' ? 'block' : 'none',
          objectFit: 'contain',
        }}
      />

      {status === 'playing' && children && <div style={overlayCardStyle}>{children}</div>}
      {status === 'playing' && (
        <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 8 }}>
          <button onClick={() => setMuted((v) => !v)} style={overlayBtnStyle}>
            {muted ? 'Включить звук' : 'Выключить звук'}
          </button>
          {getFullscreenApi(containerRef.current, videoRef.current, playbackMode) && (
            <button onClick={toggleFullscreen} style={overlayBtnStyle}>
              {isFullscreen ? 'Свернуть' : 'Полный экран'}
            </button>
          )}
        </div>
      )}
      {status !== 'playing' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: status === 'error' ? 'rgba(255,140,160,0.9)' : colors.white[4],
            textAlign: 'center',
            padding: 16,
          }}
        >
          {status === 'connecting' ? 'Подключение к потоку...' : errorMessage}
        </div>
      )}
    </div>
  )
}

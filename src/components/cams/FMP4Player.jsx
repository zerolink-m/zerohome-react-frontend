import { useEffect, useRef, useState } from 'react'
import { streamUrl, streamAuthHeaders } from '../../api/cams'
import { colors } from '../../styles/tokens'
import { debugLog, bytesToHex, bytesToAscii } from '../../utils/debugLog'
import VideoControls from './VideoControls'
import StreamStages from './StreamStages'

const STREAM_STEPS = ['Запрос потока', 'Ответ сервера', 'Инициализация fMP4', 'Подготовка декодера', 'Первый кадр']
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

function findVideoAvcC(buf, moov) {
  for (const trak of iterBoxes(buf, moov.bodyStart, moov.end)) {
    if (trak.type !== 'trak') continue
    const mdia = findBox(buf, trak.bodyStart, trak.end, 'mdia')
    if (!mdia) continue
    const hdlr = findBox(buf, mdia.bodyStart, mdia.end, 'hdlr')
    if (!hdlr) continue
    const handlerType = readBoxType(buf, hdlr.bodyStart + 8)
    if (handlerType !== 'vide') continue
    const minf = findBox(buf, mdia.bodyStart, mdia.end, 'minf')
    const stbl = minf && findBox(buf, minf.bodyStart, minf.end, 'stbl')
    const stsd = stbl && findBox(buf, stbl.bodyStart, stbl.end, 'stsd')
    if (!stsd) continue
    const avc1 = findBox(buf, stsd.bodyStart + 8, stsd.end, 'avc1')
    if (!avc1) continue
    const avcC = findBox(buf, avc1.bodyStart + 78, avc1.end, 'avcC')
    if (avcC) return buf.slice(avcC.bodyStart, avcC.end)
  }
  return null
}

function avcCodecString(avcCBytes) {
  const hex = (n) => n.toString(16).padStart(2, '0')
  return `avc1.${hex(avcCBytes[1])}${hex(avcCBytes[2])}${hex(avcCBytes[3])}`
}

// FMP4 Player - извлечен из оригинального VideoStream.jsx
export default function FMP4Player({ camId, authToken, onError, onPlaying }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const gainNodeRef = useRef(null)
  const [playbackMode, setPlaybackMode] = useState(null)
  const [stage, setStage] = useState(0)
  const [streamError, setStreamError] = useState(null)

  useEffect(() => {
    if (!camId) return
    const video = videoRef.current
    let cancelled = false
    let markedPlaying = false
    let currentStage = 0
    const advance = (next) => {
      if (!cancelled && next > currentStage) {
        currentStage = next
        setStage(next)
      }
    }
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

    function fail(message) {
      if (cancelled) return
      debugLog('stream', 'fail:', message)
      setStreamError({ message, stage: currentStage })
      cancelled = true
      controller.abort()
      if (reader) reader.cancel().catch(() => {})
      if (onError) onError(message)
    }

    function maybeMarkPlaying() {
      if (!markedPlaying && !cancelled) {
        markedPlaying = true
        advance(STREAM_STEPS.length)
        if (onPlaying) onPlaying()
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
        debugLog('mse', 'appendBuffer exception', e)
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
          debugLog('mse', 'remove exception', e)
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
        debugLog('mse', 'catching up', { end, currentTime: video.currentTime })
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
        debugLog('mse', 'addSourceBuffer exception', e)
        fail('Браузер не поддерживает воспроизведение этого потока')
        return
      }

      advance(4) // SourceBuffer открыт и принимает init-сегмент
      enqueue(initSegment)
      video.play().catch(() => {})

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
          debugLog('stream', 'read error', e)
          fail('Соединение с потоком прервано')
          return
        }
        if (chunk.done) {
          debugLog('stream', 'stream done')
          fail('Соединение с потоком прервано')
          return
        }
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

      if (videoSampleCounter < 3) {
        debugLog('webcodecs', 'video sample', {
          num: videoSampleCounter,
          isKey,
          len: bytes.length,
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
        debugLog('webcodecs', 'decode error', e)
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
        debugLog('webcodecs', 'audio decode error', e)
      }
    }

    function handleFragment(buf, parsedMoof) {
      for (const [trackId, track] of parsedMoof.tracks) {
        for (const range of track.sampleRanges) {
          const bytes = buf.slice(range.start, range.end)
          if (trackId === 1) handleVideoSample(bytes, range.keyframe)
          else if (trackId === 2) handleAudioSample(bytes)
        }
      }
    }

    async function startWebCodecs(initBuffer, moovEnd, avcC, codecString, moovBox) {
      const audioParams = findAudioParams(initBuffer, moovBox)

      videoDecoder = new VideoDecoder({
        output: handleVideoFrame,
        error: (e) => {
          debugLog('webcodecs', 'video decoder error', e)
          fail('Ошибка воспроизведения видеопотока')
        },
      })

      try {
        videoDecoder.configure({ codec: codecString, description: avcC })
      } catch (e) {
        debugLog('webcodecs', 'configure failed', e)
        fail('Не удалось настроить декодер видео')
        return
      }

      audioContext = new (window.AudioContext || window.webkitAudioContext)()
      gainNode = audioContext.createGain()
      gainNode.gain.value = 0
      gainNode.connect(audioContext.destination)
      gainNodeRef.current = gainNode

      audioDecoder = new AudioDecoder({
        output: handleAudioFrame,
        error: (e) => {
          debugLog('webcodecs', 'audio decoder error', e)
        },
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
      } catch (e) {
        debugLog('webcodecs', 'audio configure failed', e)
      }

      advance(4) // VideoDecoder настроен и цикл отрисовки запущен
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
          debugLog('stream', 'read error', e)
          fail('Соединение с потоком прервано')
          return
        }
        if (chunk.done) {
          debugLog('stream', 'stream done')
          fail('Соединение с потоком прервано')
          return
        }
        workBuffer = concatChunks([workBuffer, chunk.value], workBuffer.length + chunk.value.length)
      }
    }

    // ---------- Main start ----------

    async function start() {
      debugLog('stream', 'starting fmp4', { camId })

      let res
      try {
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : streamAuthHeaders()
        res = await fetch(streamUrl(camId), { headers, signal: controller.signal })
      } catch (e) {
        debugLog('stream', 'fetch error', e)
        if (!cancelled) fail('Не удалось подключиться к потоку')
        return
      }
      if (cancelled) return
      advance(1)

      const contentType = res.headers.get('content-type') || ''
      debugLog('stream', 'response', { status: res.status, contentType })

      if (!contentType.startsWith('video/')) {
        const json = await res.json().catch(() => null)
        if (!cancelled) fail(json?.error || 'Не удалось запустить видеопоток')
        return
      }

      if (!res.body) {
        fail('Сервер не вернул тело потока')
        return
      }
      reader = res.body.getReader()

      let initBuffer = new Uint8Array(0)
      let ftypBox = null
      let moovBox = null

      while (!cancelled && !moovBox) {
        let chunk
        try {
          chunk = await reader.read()
        } catch (e) {
          debugLog('stream', 'init read error', e)
          fail('Соединение с потоком прервано')
          return
        }
        if (chunk.done) {
          fail('Поток завершился раньше инициализации')
          return
        }
        initBuffer = concatChunks([initBuffer, chunk.value], initBuffer.length + chunk.value.length)
        if (!ftypBox) ftypBox = findBox(initBuffer, 0, initBuffer.length, 'ftyp')

        if (ftypBox) {
          advance(2)
          moovBox = findBox(initBuffer, ftypBox.end, initBuffer.length, 'moov')
          if (!moovBox) {
            const moofAfterFtyp = findBox(initBuffer, ftypBox.end, initBuffer.length, 'moof')
            if (moofAfterFtyp) {
              fail('Сервер не отдал инициализацию потока')
              return
            }
          }
        }

        if (!moovBox && initBuffer.length > MAX_INIT_BYTES) {
          fail('Некорректный формат потока')
          return
        }
      }

      if (cancelled) return

      advance(3) // ftyp и moov получены полностью
      const avcC = findVideoAvcC(initBuffer, moovBox)
      if (!avcC) {
        fail('Не удалось определить параметры видео потока')
        return
      }

      const codecString = avcCodecString(avcC)
      const mimeCodec = `video/mp4; codecs="${codecString},mp4a.40.2"`

      const mseSupported = typeof window.MediaSource !== 'undefined' && window.MediaSource.isTypeSupported(mimeCodec)

      if (mseSupported) {
        setPlaybackMode('mse')
        await startMse(initBuffer.slice(0, moovBox.end), initBuffer.slice(moovBox.end), mimeCodec)
        return
      }

      if (typeof window.VideoDecoder !== 'undefined' && typeof window.AudioDecoder !== 'undefined') {
        setPlaybackMode('webcodecs')
        await startWebCodecs(initBuffer, moovBox.end, avcC, codecString, moovBox)
        return
      }

      fail('Браузер не поддерживает воспроизведение этого потока')
    }

    function cleanup() {
      cancelled = true
      controller.abort()
      if (reader) reader.cancel().catch(() => {})

      if (sourceBuffer) {
        try {
          sourceBuffer.removeEventListener('updateend', handleUpdateEnd)
        } catch (e) {}
      }
      try {
        if (mediaSource && mediaSource.readyState === 'open') mediaSource.endOfStream()
      } catch (e) {}
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
      } catch (e) {}
      try {
        if (audioDecoder && audioDecoder.state !== 'closed') audioDecoder.close()
      } catch (e) {}
      try {
        if (audioContext && audioContext.state !== 'closed') audioContext.close()
      } catch (e) {}
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
  }, [camId, authToken, onError, onPlaying])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
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
      <StreamStages steps={STREAM_STEPS} stage={stage} finished={stage === STREAM_STEPS.length} error={streamError?.message} failedStage={streamError?.stage} />
      <VideoControls videoRef={videoRef} />
    </div>
  )
}

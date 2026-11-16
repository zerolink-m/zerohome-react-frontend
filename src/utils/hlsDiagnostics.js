import { debugLog, bytesToHex } from './debugLog'

// Диагностика сбоя нативного HLS (iOS/Safari, MEDIA_ERR_DECODE): тянет плейлист и первый
// сегмент и логирует, что именно приходит с сервера (формат контейнера, кодеки в MPEG-TS).
// Вызывается только после ошибки и только при VITE_DEBUG_LOGGING=1.

const STREAM_TYPES = {
  0x01: 'MPEG-1 video', 0x02: 'MPEG-2 video', 0x03: 'MPEG-1 audio', 0x04: 'MPEG-2 audio',
  0x0f: 'AAC (ADTS)', 0x11: 'AAC (LATM)', 0x1b: 'H.264', 0x24: 'H.265/HEVC',
  0x06: 'private (возможно G.711/Opus/AC-3)', 0x81: 'AC-3', 0x8a: 'DTS',
}

function parseTsStreams(bytes) {
  const packets = Math.floor(bytes.length / 188)
  let pmtPid = null
  const streams = []
  for (let i = 0; i < packets && streams.length === 0; i++) {
    const o = i * 188
    if (bytes[o] !== 0x47) continue
    const pid = ((bytes[o + 1] & 0x1f) << 8) | bytes[o + 2]
    const start = (bytes[o + 1] & 0x40) !== 0
    const hasPayload = (bytes[o + 3] & 0x10) !== 0
    if (!start || !hasPayload) continue
    let p = o + 4
    if (bytes[o + 3] & 0x20) p += 1 + bytes[p] // adaptation field
    p += 1 + bytes[p] // pointer_field
    const sectionLen = ((bytes[p + 1] & 0x0f) << 8) | bytes[p + 2]
    const end = p + 3 + sectionLen - 4 // без CRC
    if (pid === 0 && pmtPid == null) {
      for (let q = p + 8; q + 4 <= end; q += 4) {
        const program = (bytes[q] << 8) | bytes[q + 1]
        if (program !== 0) {
          pmtPid = ((bytes[q + 2] & 0x1f) << 8) | bytes[q + 3]
          break
        }
      }
    } else if (pmtPid != null && pid === pmtPid) {
      const infoLen = ((bytes[p + 10] & 0x0f) << 8) | bytes[p + 11]
      for (let q = p + 12 + infoLen; q + 5 <= end; ) {
        const type = bytes[q]
        streams.push({ stream_type: `0x${type.toString(16)}`, codec: STREAM_TYPES[type] || 'unknown' })
        q += 5 + (((bytes[q + 3] & 0x0f) << 8) | bytes[q + 4])
      }
    }
  }
  return { packets, syncOk: [0, 1, 2].every((n) => bytes[n * 188] === 0x47), streams }
}

export async function diagnoseNativeHls(playlistUrl) {
  try {
    debugLog('hls-diag', 'device', {
      userAgent: navigator.userAgent,
      videoElementsOnPage: document.querySelectorAll('video').length,
    })
    const plRes = await fetch(playlistUrl)
    const text = await plRes.text()
    debugLog('hls-diag', 'playlist', {
      status: plRes.status,
      contentType: plRes.headers.get('content-type'),
      head: text.split('\n').slice(0, 25).join('\n'),
    })
    const lines = text.split('\n').map((l) => l.trim())
    const segLine = lines.find((l) => l && !l.startsWith('#'))
    if (!segLine) {
      debugLog('hls-diag', 'в плейлисте нет сегментов')
      return
    }
    const mapLine = lines.find((l) => l.startsWith('#EXT-X-MAP'))
    const segUrl = new URL(segLine, playlistUrl).toString()
    const segRes = await fetch(segUrl)
    const bytes = new Uint8Array(await segRes.arrayBuffer())
    const info = {
      status: segRes.status,
      contentType: segRes.headers.get('content-type'),
      bytes: bytes.length,
      firstBytes: bytesToHex(bytes, 0, Math.min(16, bytes.length)),
      fmp4_init_segment: !!mapLine,
    }
    if (bytes[0] === 0x47) info.mpegts = parseTsStreams(bytes)
    debugLog('hls-diag', 'first segment', info)
  } catch (e) {
    debugLog('hls-diag', 'diagnostics failed', { error: e.message })
  }
}

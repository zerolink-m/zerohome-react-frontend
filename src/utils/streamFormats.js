// Утилиты для выбора оптимального формата стриминга

// Проверка поддержки форматов браузером
export function checkBrowserSupport() {
  return {
    webrtc: !!(window.RTCPeerConnection && window.WebSocket),
    hls: !!(window.MediaSource || checkNativeHLS()),
    fmp4: !!(window.MediaSource || (window.VideoDecoder && window.AudioDecoder))
  }
}

function checkNativeHLS() {
  const video = document.createElement('video')
  return video.canPlayType('application/vnd.apple.mpegurl') !== ''
}

// Проверка устройства iOS
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

// Выбор оптимального формата на основе приоритетов и поддержки
// Приоритеты: предпочитаемый протокол > WebRTC > HLS > fMP4
export function selectBestFormat(supportedStreams, browserSupport, preferredFormat = 'webrtc') {
  const enabledFormats = supportedStreams.filter(s => s.enabled)

  // Строим список приоритетов: preferred первый, затем остальные
  const defaultPriority = ['webrtc', 'hls', 'fmp4']
  const priorityList = [
    preferredFormat,
    ...defaultPriority.filter(f => f !== preferredFormat)
  ]

  // Пробуем форматы по приоритету
  for (const format of priorityList) {
    if (browserSupport[format]) {
      const found = enabledFormats.find(s => s.format === format)
      if (found) return found
    }
  }

  // Если ничего не подошло, возвращаем первый доступный
  return enabledFormats[0]
}

// Получить человекочитаемое описание формата
export function getFormatDescription(format) {
  const descriptions = {
    webrtc: 'WebRTC (задержка <1с)',
    hls: 'HLS (задержка 6-30с)',
    fmp4: 'fMP4 (задержка 2-5с)'
  }
  return descriptions[format] || format
}

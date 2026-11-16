import { WS_HTTP_BASE_URL, HOST_SWITCH_ENABLED, reportConfigCheck, getHostState } from './endpoints'
import { tracedFetch } from '../utils/webrtcDebug'
import packageJson from '../../package.json';

const FRONTEND_VERSION = import.meta.env.VITE_APP_VERSION || packageJson.version || '1.0.0-Release'
const CHECK_INTERVAL = 5000 // Проверка каждые 5 секунд (пока есть подписчики — плееры)
const CHECK_TIMEOUT = 8000 // таймаут одной проверки /config
const MONITOR_HEALTHY_MS = 30_000 // фоновый мониторинг хоста, пока WS-хост здоров
const MONITOR_DOWN_MS = 12_000 // и чаще, пока он нездоров (ждём возврата)
const MIN_RECHECK_MS = 3000 // не дублируем проверки чаще (плеер + мониторинг)
let lastCheckAt = 0
let monitorStarted = false

let webrtcAvailable = null
let checkPromise = null
let intervalId = null
let listeners = new Set()

// Проверяет доступность WebRTC на сервере через WS config endpoint
async function performCheck() {
  if (checkPromise) {
    return checkPromise
  }
  if (webrtcAvailable !== null && Date.now() - lastCheckAt < MIN_RECHECK_MS) {
    return webrtcAvailable
  }

  checkPromise = (async () => {
    try {
      // Конвертируем ws:// или wss:// в http:// или https://
      const url = `${WS_HTTP_BASE_URL}/config?v=${encodeURIComponent(FRONTEND_VERSION)}`

      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), CHECK_TIMEOUT)
      let response
      let body = null
      try {
        response = await tracedFetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          signal: ac.signal
        })
        body = await response.json().catch(() => null)
      } finally {
        clearTimeout(timer)
      }
      lastCheckAt = Date.now()

      // Здоровье хоста для выбора base URL: 2xx и валидный конверт с кодом 000 (или 020 — обновление доступно).
      const hostOk = response.ok && (body?.code === '000' || body?.code === '020')
      reportConfigCheck(hostOk, hostOk ? '' : `HTTP ${response.status}, code=${body?.code ?? 'нет JSON'}`)

      const newValue = response.status === 200
      const changed = webrtcAvailable !== null && webrtcAvailable !== newValue
      webrtcAvailable = newValue

      // Уведомляем слушателей об изменении
      if (changed) {
        listeners.forEach(callback => callback(webrtcAvailable))
      }

      return webrtcAvailable
    } catch (e) {
      console.warn('[webrtc-check] Failed to check WebRTC availability:', e.message)
      lastCheckAt = Date.now()
      reportConfigCheck(false, e.name === 'AbortError' ? `таймаут ${CHECK_TIMEOUT}ms` : e.message)
      const newValue = false
      const changed = webrtcAvailable !== null && webrtcAvailable !== newValue
      webrtcAvailable = newValue

      if (changed) {
        listeners.forEach(callback => callback(webrtcAvailable))
      }

      return false
    } finally {
      checkPromise = null
    }
  })()

  return checkPromise
}

// Запуск периодической проверки
function startPeriodicCheck() {
  if (intervalId) return // Уже запущена

  // Первая проверка сразу
  if (webrtcAvailable === null) {
    performCheck()
  }

  // Повторные проверки каждые CHECK_INTERVAL мс
  intervalId = setInterval(() => {
    // Не запускаем проверку, если вкладка неактивна
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return
    }
    performCheck()
  }, CHECK_INTERVAL)
}

// Остановка периодической проверки
function stopPeriodicCheck() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

// Подписка на изменения доступности WebRTC
export function subscribeToWebRTCChanges(callback) {
  listeners.add(callback)

  // Запускаем периодическую проверку при первой подписке
  if (listeners.size === 1) {
    startPeriodicCheck()
  }

  // Возвращаем функцию отписки
  return () => {
    listeners.delete(callback)

    // Останавливаем проверку, если нет слушателей
    if (listeners.size === 0) {
      stopPeriodicCheck()
    }
  }
}

// Получение текущего статуса (синхронная функция для быстрого доступа)
export function getWebRTCStatus() {
  return webrtcAvailable
}

// Проверяет доступность WebRTC (с запуском периодической проверки)
export async function checkWebRTCAvailability() {
  // Запускаем периодическую проверку, если еще не запущена
  if (!intervalId && listeners.size === 0) {
    startPeriodicCheck()
  }

  if (webrtcAvailable !== null) {
    return webrtcAvailable
  }

  return performCheck()
}

// Сброс кэша (для тестирования)
export function resetWebRTCCheck() {
  webrtcAvailable = null
  checkPromise = null
  stopPeriodicCheck()
  listeners.clear()
}

// Постоянный мониторинг WS-хоста (запускается из HealthProvider): здоров — раз в 30 с (скрытая вкладка
// пропускается), нездоров — каждые 12 с, пока не будет 2 успешных /config подряд (см. endpoints.js).
export function startHostMonitor() {
  if (!HOST_SWITCH_ENABLED || monitorStarted) return
  monitorStarted = true
  const tick = async () => {
    const down = getHostState().wsHealthy === false
    if (down || document.visibilityState !== 'hidden') await performCheck()
    setTimeout(tick, getHostState().wsHealthy === false ? MONITOR_DOWN_MS : MONITOR_HEALTHY_MS)
  }
  tick()
}

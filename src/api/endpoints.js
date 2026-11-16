// Выбор базового URL бэкенда: по умолчанию хост WebSocket/WebRTC (VITE_WS_BASE_URL), основной
// хост (VITE_API_BASE_URL) — фолбэк. Состояние «WS-хост здоров» обновляется мониторингом /config
// (api/webrtcCheck.js) и ошибками самих запросов (api/client.js). Модуль не импортирует client.js.
import { tlog } from '../utils/timingsLog'
import { webrtcLog } from '../utils/webrtcDebug'

export const MAIN_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1'
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/v1'

// WS-хост как HTTP(S) base: ws:// → http://, wss:// → https://.
export const WS_HTTP_BASE_URL = WS_BASE_URL.replace(/^wss?:/, (m) => (m === 'ws:' ? 'http:' : 'https:'))

// Если хосты совпадают (dev, localhost) — переключать нечего.
export const HOST_SWITCH_ENABLED = WS_HTTP_BASE_URL !== MAIN_BASE_URL

const RESTORE_STREAK = 2 // столько успешных /config подряд нужно для возврата на WS-хост
const REQUEST_FAIL_HOLD_MS = 60_000 // после сбоя реального запроса не возвращаемся минимум минуту (защита от «мигания»)

let wsHealthy = null // null — ещё не проверяли (считаем здоровым), true/false
let okStreak = 0
let holdUntil = 0
const listeners = new Set()

function emit() {
  const s = getHostState()
  listeners.forEach((fn) => fn(s))
}

export function getHostState() {
  return { enabled: HOST_SWITCH_ENABLED, wsHealthy, active: getActiveHost() }
}

function getActiveHost() {
  return HOST_SWITCH_ENABLED && wsHealthy !== false ? 'ws' : 'main'
}

// Текущий базовый URL для HTTP-запросов.
export function getBaseUrl() {
  return getActiveHost() === 'ws' ? WS_HTTP_BASE_URL : MAIN_BASE_URL
}

export function subscribeHost(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function setHealthy(v, reason) {
  if (wsHealthy === v) return
  const prev = getActiveHost()
  wsHealthy = v
  const next = getActiveHost()
  if (prev !== next) {
    tlog('хост', `переключение ${prev}→${next}`, reason)
    webrtcLog(`хост: переключение ${prev}→${next}`, reason)
  }
  emit()
}

// Результат проверки GET /config на WS-хосте.
export function reportConfigCheck(ok, reason = '') {
  if (!HOST_SWITCH_ENABLED) return
  if (ok) {
    okStreak++
    if (wsHealthy === null) setHealthy(true, 'первый /config успешен')
    else if (wsHealthy === false && okStreak >= RESTORE_STREAK && Date.now() >= holdUntil) {
      setHealthy(true, `/config успешен ${okStreak} раз подряд`)
    }
  } else {
    okStreak = 0
    setHealthy(false, `/config: ${reason}`)
  }
}

// Сбой реального запроса на WS-хост.
export function markWsUnhealthy(reason) {
  if (!HOST_SWITCH_ENABLED) return
  okStreak = 0
  holdUntil = Date.now() + REQUEST_FAIL_HOLD_MS
  setHealthy(false, reason)
}

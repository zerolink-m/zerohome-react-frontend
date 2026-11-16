import { request, getBaseUrl, WS_BASE_URL, encodeQueryToken } from './client'
import { getAccessToken } from './authStore'
import { tlog } from '../utils/timingsLog'

// GET /v1/config/frontend/supported_streams
// Получить список поддерживаемых форматов стриминга
export function getSupportedStreams() {
  return request('/config/frontend/supported_streams', { auth: false }).then(data => data.streams || [])
}

// Построить URL для HLS плейлиста
// Токен в query — dash-encoded (см. encodeQueryToken); share-токен передавайте как есть.
export function hlsPlaylistUrl(camId, token = null) {
  const params = new URLSearchParams()
  const raw = token || getAccessToken()
  if (raw) params.set('token', encodeQueryToken(raw))
  const qs = params.toString()
  return `${getBaseUrl()}/cams/${camId}/hls/playlist.m3u8${qs ? `?${qs}` : ''}`
}

// Построить WebSocket URL для WebRTC (токен — как есть, без dash-encoding)
export function webrtcWsUrl(camId, token = null) {
  // Используем WS_BASE_URL из .env для WebSocket соединений
  const accessToken = token || getAccessToken()
  const params = new URLSearchParams({ token: accessToken })
  return `${WS_BASE_URL}/cams/${camId}/webrtc?${params.toString()}`
}

// Запасной вариант, если GET /webrtc/ice недоступен: только STUN, без TURN.
const FALLBACK_ICE_SERVERS = [{ urls: 'stun:turn.qpda.ru:3478' }]

const ICE_DEFAULT_TTL_SECONDS = 3600 // учётные данные TURN живут час
const ICE_REFRESH_MARGIN_MS = 5 * 60 * 1000 // обновляем заранее, не дожидаясь истечения

const iceCache = new Map() // ключ токена → { servers, expiresAt }
const icePending = new Map() // ключ токена → Promise (одновременные плееры делят один запрос)

// GET /v1/webrtc/ice → data.ice.ice_servers (STUN + TURN с username/credential).
// Подходит access-токен или share-токен типа stream (Authorization: Bearer).
// Без token берётся текущий access-токен. При любой ошибке возвращается STUN-fallback.
export async function getIceServers(token = null) {
  const key = token || 'access'
  const cached = iceCache.get(key)
  if (cached && cached.expiresAt - ICE_REFRESH_MARGIN_MS > Date.now()) {
    tlog('кэш приложения', 'ICE-серверы: попадание', 'источник: кэш приложения (память)')
    return cached.servers
  }

  if (icePending.has(key)) tlog('кэш приложения', 'ICE-серверы: shared in-flight')
  else tlog('кэш приложения', 'ICE-серверы: промах, запрос к серверу')
  if (!icePending.has(key)) {
    const p = request('/webrtc/ice', token ? { bearer: token } : {})
      .then((data) => {
        const servers = data?.ice?.ice_servers
        if (!Array.isArray(servers) || servers.length === 0) throw new Error('empty ice_servers')
        const ttl = Number(data.ice.ttl) > 0 ? Number(data.ice.ttl) : ICE_DEFAULT_TTL_SECONDS
        iceCache.set(key, { servers, expiresAt: Date.now() + ttl * 1000 })
        return servers
      })
      .catch((e) => {
        console.warn('[webrtc] не удалось получить ICE-серверы, используем STUN:', e.message)
        return FALLBACK_ICE_SERVERS
      })
      .finally(() => icePending.delete(key))
    icePending.set(key, p)
  }
  return icePending.get(key)
}

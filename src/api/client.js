import { getAccessToken, getLegacyToken, setBearer, clear, ACCESS_STAGE_COUNT, getExchange, setExchange } from './authStore'
import { CODES, isSessionDead, isRateLimited, isSuccess } from './codes'
import { trackRequest } from './netStore'
import { getPWAHeader } from '../utils/pwa'
import { tracedFetch, getActiveTrace } from '../utils/webrtcDebug'
import { timedFetch } from '../utils/timingsLog'

// fetch с логом таймингов (VITE_TIMINGS_LOGGING) поверх WebRTC-трассы; выключено — обычный fetch.
const apiFetch = (url, opts) => timedFetch(url, opts, tracedFetch)

import { MAIN_BASE_URL, WS_BASE_URL as WS_URL, getBaseUrl, markWsUnhealthy, HOST_SWITCH_ENABLED } from './endpoints'

// BASE_URL — основной хост (фолбэк и публичные ссылки). Для запросов и синхронных URL с токеном
// используйте getBaseUrl(): по умолчанию это WS-хост, при его сбое — основной (см. endpoints.js).
export const BASE_URL = MAIN_BASE_URL
export const WS_BASE_URL = WS_URL
export { getBaseUrl }

const WS_HOST_TIMEOUT_MS = 9000 // ожидание ответа (заголовков) от WS-хоста до фолбэка
const PROXY_FAIL = new Set([502, 503, 504])
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function isEnvelope(j) {
  return !!j && typeof j === 'object' && 'code' in j
}

// Запрос на текущий хост с одним фолбэком на основной.
// Фолбэк: сетевая ошибка / таймаут / 502-504 / (expectJson) ответ не конверт API.
// Небезопасные методы (POST/PUT/PATCH/DELETE) повторяются только при сетевой ошибке до ответа
// (не при нашем таймауте: запрос мог дойти) и при 502/503/504 прокси; любые другие ответы не повторяются.
// opts.idempotent=true разрешает повтор при таймауте. Возвращает { res, json } (json — null, если не разобран).
async function hostFetch(path, init, { expectJson = true, idempotent = false, noFallback = false } = {}) {
  const method = (init.method || 'GET').toUpperCase()
  const safe = idempotent || SAFE_METHODS.has(method)
  const base = getBaseUrl()
  const parse = async (res) => {
    if (!expectJson) return null
    try { return await res.json() } catch { return null }
  }
  if (!HOST_SWITCH_ENABLED || base === MAIN_BASE_URL) {
    const res = await apiFetch(`${base}${path}`, init)
    return { res, json: await parse(res) }
  }

  const fallback = async (reason) => {
    markWsUnhealthy(`${method} ${path.split('?')[0]}: ${reason}`)
    const res = await apiFetch(`${MAIN_BASE_URL}${path}`, init)
    return { res, json: await parse(res) }
  }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), WS_HOST_TIMEOUT_MS)
  let res
  try {
    res = await apiFetch(`${base}${path}`, { ...init, signal: ac.signal })
  } catch (e) {
    clearTimeout(timer)
    const timedOut = e?.name === 'AbortError'
    if ((timedOut && !safe) || noFallback) {
      markWsUnhealthy(`${method} ${path.split('?')[0]}: таймаут, повтор не делаем (небезопасный метод)`)
      throw e
    }
    return fallback(timedOut ? `таймаут ${WS_HOST_TIMEOUT_MS}ms` : `сетевая ошибка (${e?.message || e})`)
  }
  clearTimeout(timer)
  if (PROXY_FAIL.has(res.status) && !noFallback) return fallback(`HTTP ${res.status}`)
  if (!expectJson) return { res, json: null }
  const json = await parse(res.clone())
  if (!isEnvelope(json)) {
    if (safe) return fallback(`HTTP ${res.status}, ответ не JSON-конверт`)
    markWsUnhealthy(`${method} ${path.split('?')[0]}: HTTP ${res.status}, ответ не JSON-конверт (повтор не делаем)`)
  }
  return { res, json }
}

export class ApiError extends Error {
  constructor(code, message, httpStatus, retryAfter, details) {
    super(message || 'Ошибка запроса')
    this.code = code
    this.httpStatus = httpStatus
    this.retryAfter = retryAfter
    // Error object из конверта: { error, fields, query, path, headers, hint, docs }
    this.details = details || null
  }
}

// Текст ошибки из конверта: error.error → code_detail. Опираться нужно на code, текст — для пользователя.
function envelopeMessage(json) {
  const err = json?.error
  const text = typeof err === 'string' ? err : err?.error
  return text || json?.code_detail || undefined
}

// Убирает null/undefined верхнего уровня: при создании необязательные поля просто не передаются
// (явный null для NOT NULL-колонок сервер отклоняет кодом 109).
export function omitNull(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null))
}

// Оборачивает тело в Request object: { data: { <key>: body } }.
export function wrapBody(key, body, options) {
  const req = { data: { [key]: body } }
  if (options) req.options = options
  return req
}

export function describeApiError(e) {
  if (e instanceof ApiError && isRateLimited(e.code) && e.retryAfter) {
    return `Слишком много запросов, попробуйте через ${e.retryAfter} сек.`
  }
  return e.message
}

let refreshPromise = null
const stageListeners = new Set()

function reportStage(patch) {
  setExchange(patch)
  const snapshot = getExchange()
  for (const fn of stageListeners) fn(snapshot)
}

// Только однократный обмен СТАРОГО session JWT. Новый bearer сюда не передаётся.
async function runExchange() {
  let stage = 0
  try {
    reportStage({ status: 'running', stage, error: null })
    const exchange = async () => {
      // Внутри межвкладочной блокировки перепроверяем запись: другая вкладка могла
      // уже успешно завершить обмен и сохранить bearer.
      if (getAccessToken()) return getAccessToken()
      const legacy = getLegacyToken()
      if (!legacy) throw new ApiError(CODES.TOKEN_MISSING, 'Войдите в аккаунт заново', 401)
      const hint = decodeLegacyHint(legacy)
      stage = 1
      reportStage({ stage })
      const { res, json } = await hostFetch('/auth/new-refresh', {
        method: 'POST', headers: { Authorization: `Bearer ${legacy}`, 'x-pwa': getPWAHeader() },
      }, { noFallback: true }) // не повторяем POST: обмен мог уже состояться
      stage = 2
      reportStage({ stage })
      if (!json || !isSuccess(json.code)) {
        if (getAccessToken()) return getAccessToken() // другая вкладка победила гонку
        const code = json?.code ?? CODES.SERVER_ERROR
        if (code === CODES.TOKEN_ERROR && !navigator.locks?.request) {
          await new Promise(resolve => {
            const timer = setTimeout(() => { window.removeEventListener('storage', changed); resolve() }, 2000)
            function changed(event) {
              if (event.key !== 'zc_bearer_session') return
              clearTimeout(timer)
              window.removeEventListener('storage', changed)
              resolve()
            }
            window.addEventListener('storage', changed)
          })
          if (getAccessToken()) return getAccessToken()
        }
        if (json && (isSessionDead(code) || res.status === 401)) clear()
        throw new ApiError(code, envelopeMessage(json), res.status, null, json?.error)
      }
      if (typeof json.data?.token !== 'string') throw new ApiError(CODES.SERVER_ERROR, 'Сервер не вернул токен сессии', res.status)
      // UID — только неподтверждённая подсказка до GET /users/{id}; роль из JWT не используем.
      setBearer(json.data.token, { uid: hint?.uid ?? null })
      return json.data.token
    }
    // Web Locks сериализуют обмен во всех вкладках одной origin.
    const token = navigator.locks?.request
      ? await navigator.locks.request('zc-legacy-exchange', exchange)
      : await exchange()
    reportStage({ status: 'done', stage: ACCESS_STAGE_COUNT, error: null })
    return token
  } catch (e) {
    if (getAccessToken()) {
      reportStage({ status: 'done', stage: ACCESS_STAGE_COUNT, error: null })
      return getAccessToken()
    }
    const error = e instanceof ApiError ? e : new ApiError(CODES.SERVER_ERROR, 'Не удалось обменять старую сессию: проверьте сеть', 0)
    reportStage({ status: 'error', stage, error: error.message })
    throw error
  }
}

function decodeLegacyHint(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(part))
  } catch { return null }
}

function refreshAccessToken({ onStage } = {}) {
  if (!refreshPromise) refreshPromise = runExchange().finally(() => {
    refreshPromise = null
    stageListeners.clear()
  })
  if (onStage) { stageListeners.add(onStage); onStage(getExchange()) }
  return refreshPromise
}

async function ensureValidAccessToken() {
  if (!getAccessToken() && getLegacyToken()) await refreshAccessToken()
}

// Токен (share и access) передаётся в query как ?token= с дефисом каждые 10 символов.
// Backend снимает разделители строго позиционно (каждый 11-й символ), поэтому
// токен режется на кусочки по 10 символов и склеивается через дефис — это
// отличает разделитель от "-", которые могут встретиться в самом токене.
// Исключение — WebSocket /webrtc: там токен передаётся как есть (см. API.md, 1.4).
export function encodeQueryToken(token) {
  return token?.match(/.{1,10}/g)?.join('-') ?? ''
}

// Историческое имя, оставлено для существующих импортов.
export function encodeShareToken(token) {
  return encodeQueryToken(token)
}

// Актуальный access-токен: при необходимости ждёт обновления (для кода, которому токен нужен
// сразу, например <img>/fetch снимков). null, если токен получить не удалось.
export async function getValidAccessToken() {
  try {
    await ensureValidAccessToken()
  } catch {
    // сеть/сервер недоступны — отдаём что есть
  }
  return getAccessToken()
}

// bearer — явный токен для Authorization (например share-токен); тогда обновление access не выполняется.
export async function request(path, { method = 'GET', body, auth = true, allowNonZero = false, bearer = null, includeMetadata = false, _isRetry = false } = {}) {
  const headers = {}

  // Добавляем x-pwa header для auth эндпоинтов
  if (path.startsWith('/auth/login') || path.startsWith('/auth/register') || path.startsWith('/auth/new-refresh')) {
    headers['x-pwa'] = getPWAHeader()
  }

  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (bearer) {
    headers['Authorization'] = `Bearer ${bearer}`
  } else if (auth) {
    // Проверяем и обновляем access token при необходимости
    const dbgT = getActiveTrace() ? performance.now() : 0
    try {
      await ensureValidAccessToken()
    } catch (e) {
      // Если не удалось обновить токен, продолжаем с текущим (или без него)
    }
    if (dbgT) getActiveTrace()?.log('проверка access-токена', `${path}: ${Math.round(performance.now() - dbgT)}ms`)

    const token = getAccessToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  let res
  let json = null
  const net = trackRequest()
  try {
    try {
      ;({ res, json } = await hostFetch(path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }))
    } catch (e) {
      throw new ApiError(CODES.SERVER_ERROR, 'Не удалось связаться с сервером', 0)
    }
    net.responded()

    if (!json) throw new ApiError(CODES.SERVER_ERROR, 'Некорректный ответ сервера', res.status)
  } finally {
    net.end()
  }

  if (!isSuccess(json.code)) {
    // Bearer нельзя обновить. Только прямой отказ авторизации отзывает локальный вход;
    // при параллельном входе другой вкладки повторяем один раз с её новым bearer.
    if (auth && !bearer && res.status === 401 && isSessionDead(json.code)) {
      const sent = headers['Authorization']?.slice(7) || null
      if (!_isRetry && getAccessToken() && getAccessToken() !== sent) {
        return request(path, { method, body, auth, allowNonZero, bearer, includeMetadata, _isRetry: true })
      }
      if (sent) clear(sent)
    }
    if (allowNonZero) return { code: json.code, data: json.data ?? null, ...(includeMetadata ? { metadata: json.metadata ?? null } : {}) }
    const retryAfter = isRateLimited(json.code) ? Number(res.headers.get('Retry-After')) || null : null
    throw new ApiError(json.code, envelopeMessage(json), res.status, retryAfter, json.error)
  }

  if (allowNonZero) return { code: json.code, data: json.data ?? null, ...(includeMetadata ? { metadata: json.metadata ?? null } : {}) }
  if (includeMetadata) return { code: json.code, data: json.data ?? null, metadata: json.metadata ?? null }
  return json.data
}

// GET бинарного ресурса (изображение и т.п.) с заголовком Authorization — для эндпоинтов,
// которые не принимают ?token=. Возвращает Blob; ошибки приходят обычным конвертом.
export async function fetchAuthorizedBlob(path, { _isRetry = false } = {}) {
  try {
    await ensureValidAccessToken()
  } catch {
    // продолжаем с текущим токеном
  }
  const token = getAccessToken()
  let res
  const net = trackRequest()
  let json
  try {
    try {
      ;({ res } = await hostFetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} }, { expectJson: false }))
    } catch {
      throw new ApiError(CODES.SERVER_ERROR, 'Не удалось связаться с сервером', 0)
    }
    net.responded()
    if (res.ok) return await res.blob()
    json = await res.json().catch(() => null)
  } finally {
    net.end()
  }
  const code = json?.code ?? CODES.SERVER_ERROR
  if (res.status === 401 && isSessionDead(code)) {
    if (!_isRetry && getAccessToken() && getAccessToken() !== token) {
      return fetchAuthorizedBlob(path, { _isRetry: true })
    }
    if (token) clear(token)
  }
  throw new ApiError(code, envelopeMessage(json), res.status, null, json?.error)
}

export { refreshAccessToken }

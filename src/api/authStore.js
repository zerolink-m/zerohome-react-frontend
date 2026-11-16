import { clearSnapshots } from './snapshots'

// Одна серверная сессия = один непрозрачный bearer, без client-side exp.
const KEY = 'zc_bearer_session'
const LEGACY_KEY = 'zc_session_token'
const LEGACY_ACCESS_KEY = 'zc_access_token'
const listeners = new Set()
const exchangeListeners = new Set()
export const ACCESS_STAGE_COUNT = 4
const IDLE = { status: 'idle', stage: 0, error: null }
let exchange = IDLE

function read(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function remove(key) {
  try { localStorage.removeItem(key) } catch { /* storage disabled */ }
}
function write(key, value) {
  try { localStorage.setItem(key, value) } catch { /* storage disabled */ }
}
function parseRecord(raw) {
  try {
    const record = JSON.parse(raw)
    return record && typeof record.token === 'string' && record.token.length > 0 ? record : null
  } catch { return null }
}
let record = parseRecord(read(KEY))

// Используется исключительно как подсказка старой JWT-сессии, не для нового bearer.
export function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch { return null }
}

export function getLegacyToken() { return record ? null : read(LEGACY_KEY) }
export function getState() {
  const hint = !record && decodeJwtPayload(getLegacyToken() || '')
  return {
    accessToken: record?.token ?? null,
    sessionToken: getLegacyToken(),
    isAuthenticated: !!record || !!getLegacyToken(),
    uid: record?.uid ?? hint?.uid ?? null,
    role: record?.role ?? null,
    sid: record?.sid ?? null,
    email: record?.email ?? null,
  }
}
export function getAccessToken() { return record?.token ?? null }
export function getSessionToken() { return getLegacyToken() }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
function notify() { for (const fn of listeners) fn(getState()) }
export function setBearer(token, details = {}) {
  if (!token || typeof token !== 'string') throw new Error('Сервер не вернул токен сессии')
  record = { token, uid: details.uid ?? null, email: details.email ?? null, role: details.role ?? null, sid: details.sid ?? null }
  write(KEY, JSON.stringify(record)) // сохранить до удаления legacy JWT и новых запросов
  remove(LEGACY_KEY)
  remove(LEGACY_ACCESS_KEY)
  remove('zc_session_exp')
  remove('zc_access_exp')
  notify()
}
export function setIdentity(identity, token = record?.token) {
  if (!record || record.token !== token) return
  record = { ...record, ...identity }
  write(KEY, JSON.stringify(record))
  notify()
}
export function clear(expectedToken = null) {
  if (expectedToken && getAccessToken() !== expectedToken) return
  record = null
  remove(KEY)
  remove(LEGACY_KEY)
  remove(LEGACY_ACCESS_KEY)
  remove('zc_session_exp')
  remove('zc_access_exp')
  clearSnapshots()
  exchange = IDLE
  for (const fn of exchangeListeners) fn(exchange)
  notify()
}
export function getExchange() { return exchange }
export function setExchange(patch) {
  exchange = { ...exchange, ...patch }
  for (const fn of exchangeListeners) fn(exchange)
}
export function subscribeExchange(fn) { exchangeListeners.add(fn); return () => exchangeListeners.delete(fn) }

if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key !== KEY && event.key !== LEGACY_KEY) return
  const next = parseRecord(read(KEY))
  if (next?.token === record?.token && next?.uid === record?.uid && next?.role === record?.role) return
  record = next
  notify()
})

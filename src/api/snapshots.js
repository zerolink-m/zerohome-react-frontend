// Снимки последних ответов списков (cams / switches / connections) для мгновенного показа
// при открытии страницы. Это НЕ кэш: запрос к серверу выполняется всегда, снимок лишь
// отображается, пока ответ не пришёл, и затем заменяется свежими данными.
//
// Снимки лежат в localStorage под ключом с uid пользователя и удаляются при выходе
// (authStore.clear). Секреты (пароли камер, ключи Tuya и т.п.) в снимок не попадают.

import { isTimingsLogging, snapshotShown, snapshotMiss, snapshotUpdated } from '../utils/timingsLog'

const PREFIX = 'zc_snap:'

// Время сохранения снимка (для «возраста») пишется отдельным ключом только при включённых логах таймингов.
function stamp(key) {
  if (!isTimingsLogging) return
  try { localStorage.setItem(`${key}:ts`, String(Date.now())) } catch { /* ignore */ }
}
function ageOf(key) {
  if (!isTimingsLogging) return null
  try {
    const t = Number(localStorage.getItem(`${key}:ts`))
    return t ? Math.round((Date.now() - t) / 1000) : null
  } catch { return null }
}

// Ключи, которые вырезаются на любой глубине.
const SENSITIVE_KEYS = new Set([
  'username', 'password', 'control_username', 'control_password',
  'access_secret', 'local_key', 'bot_token', 'record_metadata', 'push_metadata',
])
// У control_metadata выключателя карточке нужны только имена каналов.
const CONTROL_META_KEEP = ['dp_code', 'dp_codes']

export function sanitizeSnapshot(value) {
  if (Array.isArray(value)) return value.map(sanitizeSnapshot)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k)) continue
      if (k === 'control_metadata') {
        if (v && typeof v === 'object') {
          const kept = {}
          for (const key of CONTROL_META_KEEP) if (key in v) kept[key] = v[key]
          out[k] = kept
        }
        continue
      }
      out[k] = sanitizeSnapshot(v)
    }
    return out
  }
  return value
}

function keyFor(uid, type, filter) {
  return `${PREFIX}${uid}:${type}:${filter?.offset || 0}:${filter?.limit ?? ''}`
}

export function loadListSnapshot(uid, type, filter) {
  if (uid == null) return null
  try {
    const key = keyFor(uid, type, filter)
    const raw = localStorage.getItem(key)
    if (!raw) {
      snapshotMiss(key, `список ${type}`)
      return null
    }
    const data = JSON.parse(raw)
    if (data && Array.isArray(data.items)) {
      snapshotShown(key, `список ${type}`, ageOf(key))
      return data
    }
    return null
  } catch {
    return null
  }
}

// Только снимок списка этого uid; навигационное state дополнительно сверяется с uid и id.
export function findDevicePreview(uid, type, id, navigationState) {
  if (uid == null) return null
  const matches = (item) => item && String(item.id) === String(id) && typeof item.name === 'string'
  if (navigationState?.uid === uid && matches(navigationState.preview)) {
    return sanitizeSnapshot(navigationState.preview)
  }
  try {
    const prefix = `${PREFIX}${uid}:${type}:`
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(prefix) || key.endsWith(':ts')) continue
      const item = JSON.parse(localStorage.getItem(key))?.items?.find(matches)
      if (item) return sanitizeSnapshot(item)
    }
  } catch { /* снимок необязателен */ }
  return null
}

export function saveListSnapshot(uid, type, filter, data) {
  if (uid == null) return
  try {
    const key = keyFor(uid, type, filter)
    localStorage.setItem(key, JSON.stringify(sanitizeSnapshot(data)))
    stamp(key)
    snapshotUpdated(key, `список ${type}`)
  } catch {
    // квота/приватный режим — снимок необязателен
  }
}

// Профиль пользователя (GET /users/{id}); push_metadata с bot_token вырезается sanitize().
export function loadProfileSnapshot(uid) {
  if (uid == null) return null
  try {
    const key = `${PREFIX}${uid}:profile`
    const raw = localStorage.getItem(key)
    const data = raw ? JSON.parse(raw) : null
    if (data && typeof data === 'object') {
      snapshotShown(key, 'профиль', ageOf(key))
      return data
    }
    snapshotMiss(key, 'профиль')
    return null
  } catch {
    return null
  }
}

export function saveProfileSnapshot(uid, profile) {
  if (uid == null || !profile) return
  try {
    const key = `${PREFIX}${uid}:profile`
    localStorage.setItem(key, JSON.stringify(sanitizeSnapshot(profile)))
    stamp(key)
    snapshotUpdated(key, 'профиль')
  } catch {
    // квота/приватный режим — снимок необязателен
  }
}

export function clearSnapshots() {
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}

import { request } from './client'

// Синхронизация часов клиента с сервером по GET /v1/config/time (открытый, data.time = UTC-метка).
// Нужна, чтобы сравнивать время сегмента HLS (seg_<seq>_<timestamp>.ts) с «сейчас» на сервере,
// не завися от того, правильно ли идут часы устройства.

const RESYNC_MS = 5 * 60 * 1000
let offsetSeconds = null // серверное время − клиентское, секунды
let syncedAt = 0
let pending = null

// Метка времени в секундах: сервер/имена сегментов могут отдавать секунды, миллисекунды или микросекунды.
export function toEpochSeconds(v) {
  if (v > 1e14) return v / 1e6
  if (v > 1e11) return v / 1e3
  return v
}

async function sampleOnce() {
  const t0 = Date.now()
  const data = await request('/config/time', { auth: false })
  const t1 = Date.now()
  const raw = Number(data?.time)
  if (!Number.isFinite(raw)) throw new Error('bad /config/time response')
  // Целые секунды = значение усечено вниз, в среднем недобор 0.5 с.
  const integerSeconds = raw < 1e11 && Number.isInteger(raw)
  const server = toEpochSeconds(raw) + (integerSeconds ? 0.5 : 0)
  return { rtt: t1 - t0, integerSeconds, offset: server - (t0 + t1) / 2000 }
}

async function doSync() {
  const samples = [await sampleOnce()]
  // Целые секунды дают ±0.5 с разброса: усредняем несколько замеров в разные доли секунды.
  if (samples[0].integerSeconds) {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 310))
      samples.push(await sampleOnce())
    }
    offsetSeconds = samples.reduce((a, s) => a + s.offset, 0) / samples.length
  } else {
    offsetSeconds = samples[0].offset
  }
  syncedAt = Date.now()
}

// Запускает синхронизацию, если часы ещё не синхронизированы или данные старше 5 минут.
export function ensureServerClock() {
  if (offsetSeconds != null && Date.now() - syncedAt < RESYNC_MS) return Promise.resolve()
  if (!pending) {
    pending = doSync()
      .catch((e) => console.warn('[server-time] не удалось синхронизировать часы:', e.message))
      .finally(() => {
        pending = null
      })
  }
  return pending
}

export const hasServerClock = () => offsetSeconds != null

// Текущее серверное время, секунды (UTC).
export const getServerNowSeconds = () => Date.now() / 1000 + (offsetSeconds ?? 0)

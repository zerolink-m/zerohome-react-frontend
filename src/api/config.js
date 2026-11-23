import { request } from './client'
import { CODES } from './codes'
import packageJson from '../../package.json';

const FRONTEND_VERSION = "v" + (import.meta.env.VITE_APP_VERSION || packageJson.version || '1.0.0-Release')
// GET /config?v=vMAJOR.MINOR.PATCH-Channel
// Бэкенд решает по версии клиента:
//   000 — актуальная версия, data.config = { version, actual_version }
//   384 — доступно необязательное обновление
//   387 — обязательное обновление
//   059 — v неверного формата
// В отличие от остальных эндпоинтов, коды 384/387 должны дойти до вызывающего кода,
// поэтому используем allowNonZero (см. request() в client.js).
export async function getConfig() {
  const v = encodeURIComponent(FRONTEND_VERSION)
  const { code, data } = await request(`/config?v=${v}`, { auth: false, allowNonZero: true })
  if (code === CODES.FRONTEND_UPDATE_NEEDED) return { code, version: null, actualVersion: null }
  // Любой другой код ошибки (059, 314, 321, 201…) — это сбой проверки, а не «онлайн».
  if (code !== CODES.OK && code !== CODES.FRONTEND_UPDATE_AVAILABLE) {
    throw new Error(`Config check failed: ${code}`)
  }
  // data.config.version в /config — это эхо версии ФРОНТЕНДА (параметр v), а не бэкенда.
  // Версия бэкенда — GET /version → data.version.app.
  let backendVersion = null
  try {
    const res = await request('/version', { auth: false, allowNonZero: true })
    backendVersion = res?.data?.version?.app ?? null
  } catch {
    // версия бэкенда недоступна — покажем «—»
  }
  return {
    code,
    version: backendVersion,
    actualVersion: data?.config?.actual_version ?? null,
  }
}

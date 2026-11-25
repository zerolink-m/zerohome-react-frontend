import { request } from './client'
import { CODES } from './codes'
import { FRONTEND_API_VERSION } from '../utils/frontendVersion'
// GET /config?v=vMAJOR.MINOR.PATCH-Channel
// Бэкенд решает по версии клиента:
//   CODES.OK — актуальная версия, data.config = { version, actual_version }
//   CODES.FRONTEND_UPDATE_AVAILABLE — доступно необязательное обновление
//   CODES.FRONTEND_UPDATE_NEEDED — обязательное обновление
//   CODES.BAD_REQUEST — v неверного формата
// В отличие от остальных эндпоинтов, коды обновления должны дойти до вызывающего кода,
// поэтому используем allowNonZero (см. request() в client.js).
export async function getConfig() {
  const v = encodeURIComponent(FRONTEND_API_VERSION)
  const { code, data } = await request(`/config?v=${v}`, { auth: false, allowNonZero: true })
  if (code === CODES.FRONTEND_UPDATE_NEEDED) return { code, version: null, actualVersion: null }
  // Любой другой код ошибки — это сбой проверки, а не «онлайн».
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

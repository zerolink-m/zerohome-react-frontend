// Строковые коды ответов cursedapi v1.1 (см. API.md, раздел 1.3)

export const CODES = {
  // Успех
  OK: '000',
  CREATED: '001',
  UPDATED: '003',
  NOT_MODIFIED: '005',
  DELETED: '007',
  EMPTY: '012',
  FRONTEND_UPDATE_AVAILABLE: '020', // HTTP 200, данные отдаются

  // Ошибки клиента
  BAD_REQUEST: '040',
  TOKEN_ERROR: '042',
  TOKEN_EXPIRED: '043',
  TOKEN_BAD_KEY: '044',
  TOKEN_BAD_ALG: '045',
  TOKEN_MISSING: '046',
  TOKEN_MALFORMED: '149',
  FORBIDDEN_ROLE: '050',
  FORBIDDEN_RESOURCE: '051',
  TUYA_LOCAL_NOT_ALLOWED: '061',
  RECORDING_NOT_ALLOWED: '062',
  FRONTEND_UPDATE_NEEDED: '063', // HTTP 403, без data — обязательное обновление
  NOT_FOUND: '082',
  VALIDATION: '109',
  PTZ_LOCKED: '110',
  RATE_LIMITED: '114', // глобальный; см. isRateLimited()
  RATE_LIMITED_LOGIN: '172',
  RATE_LIMITED_ENDPOINT: '173',
  EMAIL_TAKEN: '139',
  BAD_CREDENTIALS: '138',
  PTZ_NOT_CONFIGURED: '176',
  RECORDING_NOT_CONFIGURED: '177',
  INVITATION_INVALID: '178',
  SHARE_INVALID: '180',
  CONNECTION_INVALID: '190',

  // Ошибки сервера
  SERVER_ERROR: '201',
}

// Коды, означающие проблему с токеном (access/session недействителен).
const AUTH_ERROR_CODES = new Set(['042', '043', '044', '045', '046', '149'])
// Для session-токена «окончательно мёртвые» коды (истёк/не тот ключ/не JWT/удалена сессия).
const SESSION_DEAD_CODES = new Set(['042', '043', '044', '045', '149'])

export const isAuthError = (code) => AUTH_ERROR_CODES.has(code)
export const isSessionDead = (code) => SESSION_DEAD_CODES.has(code)
export const isRateLimited = (code) => code === '114' || code === '172' || code === '173'
// Коды успеха — 000..039 (ошибки начинаются с 040)
export const isSuccess = (code) => Number(code) < 40

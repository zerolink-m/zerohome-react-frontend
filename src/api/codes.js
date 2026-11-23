// Коды cursedapi v1.2 и ZeroHome из API.md.

export const CODES = {
  // Успешные ответы, используемые клиентом.
  OK: '000',
  UPDATED: '002',
  PARTIALLY_UPDATED: '004',
  NO_CHANGE: '007',
  DELETED: '009',
  PARTIALLY_DELETED: '012',
  AUTHORIZED: '014',
  EMPTY: '019',
  LOGGED_OUT: '034',
  TOKEN_REFRESHED: '036',
  CREATED: '039',
  PARTIALLY_CREATED: '041',

  // Ошибки и ограничения.
  BAD_REQUEST: '059',
  INVALID_JSON: '063',
  INVALID_QUERY: '066',
  REQUIRED_FIELD: '068',
  TYPE_MISMATCH: '070',
  BAD_CREDENTIALS: '113',
  EMAIL_TAKEN: '115',
  RATE_LIMITED: '314',
  RATE_LIMITED_LOGIN: '319',
  RATE_LIMITED_ENDPOINT: '321',
  TOKEN_ERROR: '167',
  TOKEN_EXPIRED: '170',
  TOKEN_MISSING: '177',
  FORBIDDEN_ROLE: '186',
  FORBIDDEN_RESOURCE: '189',
  NOT_FOUND: '215',
  ROUTE_NOT_FOUND: '217',
  METHOD_NOT_ALLOWED: '226',
  VALIDATION: '269',
  EMPTY_LIST_POSITION: '297',
  SEARCH_LENGTH_MISMATCH: '300',
  FUNCTION_NOT_SUPPORTED: '153',
  LIMIT_TOO_HIGH: '158',

  // ZeroHome application codes.
  TUYA_LOCAL_NOT_ALLOWED: '385',
  RECORDING_NOT_ALLOWED: '386',
  FRONTEND_UPDATE_AVAILABLE: '384',
  FRONTEND_UPDATE_NEEDED: '387',
  PTZ_NOT_CONFIGURED: '388',
  RECORDING_NOT_CONFIGURED: '389',
  INVITATION_INVALID: '390',
  SHARE_INVALID: '392',
  CONNECTION_INVALID: '393',
  PTZ_LOCKED: '302',

  // Локальный код клиента для сетевых/неизвестных ошибок.
  SERVER_ERROR: '201',
}

const SUCCESS_CODES = new Set([
  CODES.OK,
  CODES.UPDATED,
  CODES.PARTIALLY_UPDATED,
  CODES.NO_CHANGE,
  CODES.DELETED,
  CODES.PARTIALLY_DELETED,
  CODES.AUTHORIZED,
  CODES.EMPTY,
  CODES.LOGGED_OUT,
  CODES.TOKEN_REFRESHED,
  CODES.CREATED,
  CODES.PARTIALLY_CREATED,
])

// Ошибки токенов перечислены в API.md как диапазон 167–177.
const AUTH_ERROR_CODES = new Set(Array.from({ length: 11 }, (_, i) => String(167 + i).padStart(3, '0')))
// Только эти коды означают, что сохранённая bearer-сессия недействительна.
const SESSION_DEAD_CODES = new Set([CODES.TOKEN_ERROR, CODES.TOKEN_EXPIRED])
const RATE_LIMIT_CODES = new Set([CODES.RATE_LIMITED, CODES.RATE_LIMITED_LOGIN, CODES.RATE_LIMITED_ENDPOINT])

export const isAuthError = (code) => AUTH_ERROR_CODES.has(code)
export const isSessionDead = (code) => SESSION_DEAD_CODES.has(code)
export const isRateLimited = (code) => RATE_LIMIT_CODES.has(code)
export const isSuccess = (code) => SUCCESS_CODES.has(String(code))

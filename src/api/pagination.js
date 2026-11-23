// Общий хелпер построения query-строки для offset/limit/search_method/search_column/search

// Серверный default limit — 25 (у recordings 10, у motion_events 50); фронт всегда передаёт limit явно.
export const DEFAULT_OFFSET = 0
export const DEFAULT_LIMIT = 25
export const LIMIT_MIN = 1
export const LIMIT_MAX = 255

export const SEARCH_COLUMNS = {
  users: ['id', 'name', 'surname', 'email', 'role', 'added_at', 'updated_at'],
  sessions: ['id', 'uid', 'ua', 'ip', 'last_login', 'added_at', 'updated_at'],
  cams: ['id', 'name', 'address', 'protocol', 'enabled', 'added_at', 'updated_at'],
  switches: ['id', 'name', 'enabled', 'control_protocol', 'state', 'added_at', 'updated_at'],
  connections: ['id', 'provider', 'name', 'enabled', 'added_at', 'updated_at'],
  invitations: ['id', 'device_type', 'device_id', 'email', 'status', 'invited_by', 'added_at', 'updated_at'],
  shares: ['id', 'uid', 'type', 'device_type', 'device_id', 'added_at', 'updated_at'],
}

export const SEARCH_COLUMN_LABELS = {
  users: {
    id: 'ID пользователя',
    name: 'Имя',
    surname: 'Фамилия',
    email: 'Email',
    role: 'Роль',
    added_at: 'Дата создания',
    updated_at: 'Дата обновления',
  },
  sessions: {
    id: 'ID сессии',
    uid: 'ID пользователя',
    ua: 'Клиент (User-Agent)',
    ip: 'IP-адрес',
    last_login: 'Последний вход',
    added_at: 'Дата создания',
    updated_at: 'Дата обновления',
  },
  cams: {
    id: 'Номер камеры',
    name: 'Название',
    address: 'Адрес камеры',
    enabled: 'Статус',
    protocol: 'Протокол',
    added_at: 'Дата создания',
    updated_at: 'Дата обновления',
  },
  switches: {
    id: 'Номер выключателя',
    name: 'Название',
    enabled: 'Статус',
    control_protocol: 'Протокол управления',
    state: 'Состояние',
    added_at: 'Дата создания',
    updated_at: 'Дата обновления',
  },
  connections: {
    id: 'ID',
    provider: 'Провайдер',
    name: 'Название',
    enabled: 'Включено',
    added_at: 'Добавлено',
    updated_at: 'Обновлено',
  },
  invitations: {
    id: 'ID',
    device_type: 'Тип устройства',
    device_id: 'ID устройства',
    email: 'Email',
    status: 'Статус',
    invited_by: 'Кто пригласил',
    added_at: 'Дата создания',
    updated_at: 'Дата обновления',
  },
  shares: {
    id: 'ID',
    uid: 'ID владельца',
    type: 'Тип',
    device_type: 'Тип устройства',
    device_id: 'ID устройства',
    added_at: 'Дата создания',
    updated_at: 'Дата обновления',
  },
}

// Значение с запятой или кавычкой в list-query берётся в кавычки (кавычки внутри удваиваются).
function quoteListValue(v) {
  const str = String(v)
  return /[,"]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export function buildQuery(filter) {
  if (!filter) return ''
  const params = new URLSearchParams()
  if (filter.offset != null && filter.offset > 0) params.set('offset', filter.offset)
  if (filter.limit != null) params.set('limit', filter.limit)
  const serializeList = (value) => Array.isArray(value)
    ? value.map(quoteListValue).join(',')
    : value != null ? quoteListValue(value) : ''
  if (filter.sort_by) params.set('sort_by', serializeList(filter.sort_by))
  if (filter.order) params.set('order', serializeList(filter.order))
  // Массивы задают позиционные условия поиска; строка остаётся одним значением,
  // включая запятые, которые экранируются кавычками.
  if (filter.search != null && filter.search !== '' && filter.search_column) {
    params.set('search', serializeList(filter.search))
    params.set('search_column', serializeList(filter.search_column))
    if (filter.search_method) params.set('search_method', serializeList(filter.search_method))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// Приводит список cursedapi к виду { items, total, offset, limit }:
// data = { settings: { total, limit, offset, … }, <ключ ресурса>: [...] }.
export function normalizeList(data, key, defaultLimit = DEFAULT_LIMIT) {
  const items = data?.[key] || []
  const settings = data?.settings || {}
  return {
    items,
    total: settings.total ?? items.length,
    offset: settings.offset ?? 0,
    limit: settings.limit ?? defaultLimit,
  }
}

import { request, fetchAuthorizedBlob } from './client'
import { buildQuery, normalizeList } from './pagination'

// GET /v1/cams/{id}/motion/events — общий list-query (limit по умолчанию 50, максимум 200).
// Фильтр по типу объекта — через search/search_column (точное совпадение).
export function listMotionEvents(camId, options = {}) {
  const { object_type, ...filter } = options
  if (filter.limit == null) filter.limit = 50
  if (filter.offset == null) filter.offset = 0
  if (object_type != null && filter.search == null) {
    filter.search = object_type
    filter.search_column = 'object_type'
    filter.search_method = 'equals'
  }
  return request(`/cams/${camId}/motion/events${buildQuery(filter)}`).then(data => {
    const list = normalizeList(data, 'motion_events', 50)
    return { events: list.items, total: list.total, limit: list.limit, offset: list.offset }
  })
}

export function getMotionEvent(eventId) {
  return request(`/motion/events/${eventId}`).then(data => data.motion_event)
}

export function deleteMotionEvent(eventId) {
  return request(`/motion/events/${eventId}`, { method: 'DELETE' }).then(data => data.motion_event)
}

// GET /v1/motion/events/{id}/photo принимает только Authorization (?token= на этом эндпоинте
// не поддерживается), поэтому <img src> напрямую использовать нельзя — берём blob через fetch.
export async function fetchMotionEventPhoto(eventId) {
  return fetchAuthorizedBlob(`/motion/events/${eventId}/photo`)
}

import { request, wrapBody } from './client'
import { buildQuery, normalizeList } from './pagination'

// POST /v1/shares — создать share-ссылку. Ответ: 001, data.share =
// { id, type, device_type, device_id, filename, token, expires_at }.
export function createShare({ device_type, device_id, type, filename, ttl_seconds }) {
  const body = { device_type, device_id, type, ttl_seconds }
  if (filename) body.filename = filename
  return request('/shares', { method: 'POST', body: wrapBody('share', body) }).then(data => data.share)
}

// GET /v1/shares — список share-ссылок пользователя (admin — все).
// Общая пагинация/поиск; фильтра по device_type/device_id в API нет.
export function listShares(filter = {}) {
  return request(`/shares${buildQuery(filter)}`).then(data => normalizeList(data, 'shares'))
}

// DELETE /v1/shares/{share_id} — отозвать ссылку.
export function deleteShare(shareId) {
  return request(`/shares/${shareId}`, { method: 'DELETE' }).then(data => data.share)
}

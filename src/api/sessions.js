import { request } from './client'
import { buildQuery, normalizeList } from './pagination'

// Префикс /v1/users/{user_id}/sessions: доступ — self/admin.
export function listSessions(userId, filter) {
  return request(`/users/${userId}/sessions${buildQuery(filter)}`).then(data => normalizeList(data, 'sessions'))
}

export function getSession(userId, id) {
  return request(`/users/${userId}/sessions/${id}`).then(data => data.session)
}

export function deleteSession(userId, id) {
  return request(`/users/${userId}/sessions/${id}`, { method: 'DELETE' }).then(data => data.session)
}

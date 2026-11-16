import { request, wrapBody } from './client'
import { buildQuery, normalizeList } from './pagination'

// GET /v1/users: admin видит всех, обычный пользователь — только себя.
export function listUsers(filter) {
  return request(`/users${buildQuery(filter)}`).then(data => normalizeList(data, 'users'))
}

// Профиль владельца текущего bearer без поиска по email или сохранённого uid.
export function getMe() {
  return request('/users/me').then(data => data.user)
}

export function getUser(id) {
  return request(`/users/${id}`).then(data => data.user)
}

export function createUser(body) {
  return request('/users', { method: 'POST', body: wrapBody('user', body) }).then(data => data.user)
}

export function patchUser(id, body) {
  return request(`/users/${id}`, { method: 'PATCH', body: wrapBody('user', body) }).then(data => data.user)
}

export function deleteUser(id) {
  return request(`/users/${id}`, { method: 'DELETE' }).then(data => data.user)
}

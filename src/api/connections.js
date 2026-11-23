import { request, wrapBody } from './client'
import { buildQuery, normalizeList } from './pagination'

// Список допустимых Tuya-эндпоинтов (см. API.md): код региона или полный hostname.
export const TUYA_ENDPOINTS = [
  { value: 'eu', label: 'EU (eu)' },
  { value: 'eu-w', label: 'EU West (eu-w)' },
  { value: 'us', label: 'US (us)' },
  { value: 'us-e', label: 'US East (us-e)' },
  { value: 'cn', label: 'CN (cn)' },
  { value: 'in', label: 'IN (in)' },
  { value: 'sg', label: 'SG (sg)' },
]

export function listConnections(filter) {
  return request(`/connections${buildQuery(filter)}`).then(data => normalizeList(data, 'connections'))
}

export function getConnection(id) {
  return request(`/connections/${id}`).then(data => data.connection)
}

// POST /v1/connections — data.connection в ответе создания.
export function createConnection(body) {
  return request('/connections', { method: 'POST', body: wrapBody('connection', body) }).then(data => data.connection)
}

export function patchConnection(id, body) {
  return request(`/connections/${id}`, { method: 'PATCH', body: wrapBody('connection', body) }).then(data => data.connection)
}

export function deleteConnection(id) {
  return request(`/connections/${id}`, { method: 'DELETE' }).then(data => data.connection)
}

export function syncConnection(id) {
  return request(`/connections/${id}/sync`, { method: 'POST' }).then(data => data.connection)
}

import { request, wrapBody } from './client'
import { buildQuery, normalizeList, LIMIT_MAX } from './pagination'

// POST /v1/invitations — создать приглашение. Ответ: 001, data.invitation (status = pending).
export function createInvitation({ device_type, device_id, email }) {
  return request('/invitations', { method: 'POST', body: wrapBody('invitation', { device_type, device_id, email }) })
    .then(data => data.invitation)
}

// GET /v1/invitations — список: отправленные + полученные по email (admin — все).
// Общая пагинация/поиск; фильтра по device_type/device_id в API нет.
export function listInvitations(filter = { limit: LIMIT_MAX }) {
  return request(`/invitations${buildQuery(filter)}`).then(data => normalizeList(data, 'invitations'))
}

// POST /v1/invitations/{id}/accept — принять (адресат или admin). Тела нет. Ответ: data.invitation.
export function acceptInvitation(id) {
  return request(`/invitations/${id}/accept`, { method: 'POST' }).then(data => data.invitation)
}

// POST /v1/invitations/{id}/decline — отклонить (приглашение удаляется). Тела нет.
export function declineInvitation(id) {
  return request(`/invitations/${id}/decline`, { method: 'POST' }).then(data => data.invitation)
}

// DELETE /v1/invitations/{id} — удалить приглашение (отправитель, адресат или admin).
export function deleteInvitation(invitationId) {
  return request(`/invitations/${invitationId}`, { method: 'DELETE' }).then(data => data.invitation)
}

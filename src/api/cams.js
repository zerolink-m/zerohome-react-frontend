import { request, getBaseUrl, encodeQueryToken, wrapBody, omitNull } from './client'
import { buildQuery, normalizeList, LIMIT_MAX } from './pagination'
import { getAccessToken } from './authStore'

export function listCams(filter = { limit: LIMIT_MAX }) {
  return request(`/cams${buildQuery(filter)}`).then(data => normalizeList(data, 'cams'))
}

export function getCam(id) {
  return request(`/cams/${id}`).then(data => data.cam)
}

export function createCam(body) {
  return request('/cams', { method: 'POST', body: wrapBody('cam', omitNull(body)) }).then(data => data.cam)
}

export function patchCam(id, body) {
  return request(`/cams/${id}`, { method: 'PATCH', body: wrapBody('cam', body) }).then(data => data.cam)
}

export function deleteCam(id) {
  return request(`/cams/${id}`, { method: 'DELETE' }).then(data => data.cam)
}

export function getPtz(id, { shareToken } = {}) {
  if (shareToken) {
    const params = new URLSearchParams({ token: encodeQueryToken(shareToken) })
    return request(`/cams/${id}/ptz?${params.toString()}`, { auth: false }).then(data => data.ptz)
  }
  return request(`/cams/${id}/ptz`).then(data => data.ptz)
}

export function setPtz(id, body, { shareToken } = {}) {
  if (shareToken) {
    const params = new URLSearchParams({ token: encodeQueryToken(shareToken) })
    return request(`/cams/${id}/ptz?${params.toString()}`, { method: 'POST', body: wrapBody('ptz', body), auth: false }).then(data => data.ptz)
  }
  return request(`/cams/${id}/ptz`, { method: 'POST', body: wrapBody('ptz', body) }).then(data => data.ptz)
}

export function streamUrl(id) {
  return `${getBaseUrl()}/cams/${id}/stream`
}

export function streamAuthHeaders() {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function recordingConfig(data) {
  const c = data.recording_config || {}
  return {
    record: c.record ?? 0,
    record_type: c.record_type ?? null,
    record_metadata: c.record_metadata ?? null,
  }
}

export function getRecordingSettings(id) {
  return request(`/cams/${id}/recording`).then(recordingConfig)
}

// PATCH /v1/cams/{id}/recording: ответ — data.recording_config = { record, record_type, record_metadata }.
export function patchRecordingSettings(id, body) {
  return request(`/cams/${id}/recording`, { method: 'PATCH', body: wrapBody('recording_config', body) }).then(recordingConfig)
}

// List-query записей (default 10, max 100) + временной диапазон from/to (unix).
export function listRecordings(id, { offset, limit, from, to, ...listQuery } = {}) {
  const params = new URLSearchParams(buildQuery({ offset, limit, ...listQuery }).slice(1))
  if (from != null) params.set('from', from)
  if (to != null) params.set('to', to)
  const qs = params.toString()
  return request(`/cams/${id}/recordings${qs ? `?${qs}` : ''}`).then(data => normalizeList(data, 'recordings', 10))
}

export function getRecording(id, recordingId) {
  return request(`/cams/${id}/recordings/${encodeURIComponent(recordingId)}`).then(data => data.recording)
}

// <video>/<img> не могут передать заголовок Authorization, поэтому токен передаётся
// через query-параметр ?token= (см. API.md, 1.4). И access-, и share-токен — dash-encoded
// (дефис каждые 10 символов, см. encodeQueryToken в client.js).
export function recordingFileUrl(id, recordingId) {
  const token = encodeQueryToken(getAccessToken() || '')
  const params = new URLSearchParams({ token })
  return `${getBaseUrl()}/cams/${id}/recordings/${encodeURIComponent(recordingId)}/file?${params.toString()}`
}

export function recordingFileUrlWithToken(id, recordingId, shareToken) {
  const params = new URLSearchParams({ token: encodeQueryToken(shareToken || '') })
  return `${getBaseUrl()}/cams/${id}/recordings/${encodeURIComponent(recordingId)}/file?${params.toString()}`
}

export function recordingSnapshotUrl(id, recordingId, at) {
  const token = encodeQueryToken(getAccessToken() || '')
  const params = new URLSearchParams({ token })
  if (at != null) params.set('at', at)
  return `${getBaseUrl()}/cams/${id}/recordings/${encodeURIComponent(recordingId)}/snapshot?${params.toString()}`
}

// Motion detection
export function getMotionStatus(camId) {
  return request(`/cams/${camId}/motion/status`).then(data => data.motion)
}

export function startMotionDetection(camId) {
  return request(`/cams/${camId}/motion/start`, { method: 'POST' }).then(data => data.motion)
}

export function stopMotionDetection(camId) {
  return request(`/cams/${camId}/motion/stop`, { method: 'POST' }).then(data => data.motion)
}

// Snapshot
export function snapshotUrl(camId) {
  const token = encodeQueryToken(getAccessToken() || '')
  const params = new URLSearchParams({ token })
  return `${getBaseUrl()}/cams/${camId}/snapshot?${params.toString()}`
}

// ONVIF settings
export function patchOnvifSettings(camId, body) {
  return request(`/cams/${camId}/onvif`, { method: 'PATCH', body: wrapBody('onvif', body) }).then(data => data.onvif)
}

// Push settings: PATCH принимает только настройки (серверные id/user_id/device_*/created_at/updated_at
// из GET-ответа отклоняются как неизвестные поля, 109).
const PUSH_READONLY = ['id', 'user_id', 'device_type', 'device_id', 'created_at', 'updated_at']
export function pushSettingsPatch(settings) {
  const body = { ...settings }
  for (const k of PUSH_READONLY) delete body[k]
  return body
}

// Push settings
export function getPushSettings(camId) {
  return request(`/cams/${camId}/push-settings`).then(data => data.push_settings)
}

export function patchPushSettings(camId, body) {
  return request(`/cams/${camId}/push-settings`, { method: 'PATCH', body: wrapBody('push_settings', pushSettingsPatch(body)) }).then(data => data.push_settings)
}

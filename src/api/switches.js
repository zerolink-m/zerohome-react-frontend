import { request, encodeQueryToken, wrapBody, omitNull } from './client'
import { pushSettingsPatch } from './cams'
import { buildQuery, normalizeList } from './pagination'

export function listSwitches(filter) {
  return request(`/switches${buildQuery(filter)}`).then(data => normalizeList(data, 'switches'))
}

export function getSwitch(id) {
  return request(`/switches/${id}`).then(data => data.switch)
}

export function createSwitch(body) {
  return request('/switches', { method: 'POST', body: wrapBody('switch', omitNull(body)) }).then(data => data.switch)
}

export function patchSwitch(id, body) {
  return request(`/switches/${id}`, { method: 'PATCH', body: wrapBody('switch', body) }).then(data => data.switch)
}

export function deleteSwitch(id) {
  return request(`/switches/${id}`, { method: 'DELETE' }).then(data => data.switch)
}

export function getSwitchState(id, { shareToken } = {}) {
  if (shareToken) {
    const params = new URLSearchParams({ token: encodeQueryToken(shareToken) })
    return request(`/switches/${id}/state?${params.toString()}`, { auth: false }).then(data => data.state)
  }
  return request(`/switches/${id}/state`).then(data => data.state)
}

export function setSwitchState(id, state, { shareToken } = {}) {
  if (shareToken) {
    const params = new URLSearchParams({ token: encodeQueryToken(shareToken) })
    return request(`/switches/${id}/state?${params.toString()}`, { method: 'POST', body: wrapBody('state', { state }), auth: false }).then(data => data.state)
  }
  return request(`/switches/${id}/state`, { method: 'POST', body: wrapBody('state', { state }) }).then(data => data.state)
}

// Push settings for switches
export function getSwitchPushSettings(switchId) {
  return request(`/switches/${switchId}/push-settings`).then(data => data.push_settings)
}

export function patchSwitchPushSettings(switchId, body) {
  return request(`/switches/${switchId}/push-settings`, { method: 'PATCH', body: wrapBody('push_settings', pushSettingsPatch(body)) }).then(data => data.push_settings)
}

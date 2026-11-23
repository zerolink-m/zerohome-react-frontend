import { request, wrapBody } from './client'
import { buildQuery, normalizeList } from './pagination'

export async function listSystemSettings(filter) {
  const response = await request(`/system-settings${buildQuery(filter)}`, { includeMetadata: true })
  const list = normalizeList(response.data, 'system_settings')
  return { ...list, settings: response.data?.settings ?? {}, revision: response.metadata?.revision ?? null }
}

export async function getSystemSetting(key) {
  const response = await request(`/system-settings/${encodeURIComponent(key)}`, { includeMetadata: true })
  return { setting: response.data?.system_setting, revision: response.metadata?.revision ?? null }
}

export async function patchSystemSetting(key, value) {
  const response = await request(`/system-settings/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: wrapBody('setting', { value }),
    includeMetadata: true,
  })
  return {
    setting: response.data?.system_setting,
    revision: response.metadata?.revision ?? null,
    restartRequired: response.metadata?.restart_required === true,
  }
}

import { request } from './client'
import { buildQuery, normalizeList } from './pagination'

export async function getCluster() {
  const response = await request('/cluster', { includeMetadata: true })
  return { cluster: response.data?.cluster, metadata: response.metadata ?? {} }
}

export async function listAssignments(filter) {
  const response = await request(`/assignments${buildQuery(filter)}`, { includeMetadata: true })
  const list = normalizeList(response.data, 'assignments')
  return { ...list, settings: response.data?.settings ?? {}, metadata: response.metadata ?? {} }
}

export async function getAssignment(fn, resourceId) {
  const path = `/assignments/${encodeURIComponent(fn)}/${encodeURIComponent(resourceId)}`
  const response = await request(path, { includeMetadata: true })
  return { assignment: response.data?.assignment, metadata: response.metadata ?? {} }
}

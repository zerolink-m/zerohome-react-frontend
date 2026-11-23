import { request, wrapBody } from './client'
import { buildQuery, normalizeList } from './pagination'

export async function listNodes(filter) {
  const response = await request(`/nodes${buildQuery(filter)}`, { includeMetadata: true })
  const list = normalizeList(response.data, 'nodes')
  return { ...list, settings: response.data?.settings ?? {}, revision: response.metadata?.revision ?? null }
}

export async function getNode(nodeId) {
  const response = await request(`/nodes/${encodeURIComponent(nodeId)}`, { includeMetadata: true })
  return { node: response.data?.node, revision: response.metadata?.revision ?? null }
}

export async function patchNode(nodeId, patch) {
  const response = await request(`/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'PATCH',
    body: wrapBody('node', patch),
    includeMetadata: true,
  })
  return {
    node: response.data?.node,
    revision: response.metadata?.revision ?? null,
    restartRequired: response.metadata?.restart_required === true,
  }
}

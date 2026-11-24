// /config expects a single leading `v`; VITE_APP_VERSION may already include it.
export function normalizeFrontendVersion(version) {
  const value = String(version || '').trim().replace(/^v+/i, '')
  return `v${value || '1.0.0-Release'}`
}

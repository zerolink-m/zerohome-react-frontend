import { version } from '../../package.json'

export const FRONTEND_VERSION = version.trim().replace(/^v+/i, '')
export const FRONTEND_API_VERSION = `v${FRONTEND_VERSION}`

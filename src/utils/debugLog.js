export const DEBUG_LOGGING = import.meta.env.VITE_DEBUG_LOGGING === '1'

function redact(value) {
  if (typeof value !== 'string') return value
  return value.replace(/([?&](?:token|access_token|key|secret|password)=)[^&#\s]*/gi, '$1***')
}

export function debugLog(scope, ...args) {
  if (!DEBUG_LOGGING) return
  const safe = args.map(arg => {
    if (typeof arg === 'string') return redact(arg)
    if (arg && typeof arg === 'object') {
      try {
        const seen = new WeakSet()
        return JSON.parse(JSON.stringify(arg, (key, value) => {
          if (/^(?:token|authorization|password|secret|credential)$/i.test(key)) return '***'
          if (value && typeof value === 'object') {
            if (seen.has(value)) return '[circular]'
            seen.add(value)
          }
          return redact(value)
        }))
      } catch { return '[object]' }
    }
    return arg
  })
  // eslint-disable-next-line no-console
  console.log(`[debug:${scope}]`, ...safe)
}

export function bytesToHex(buf, start = 0, end = buf.length) {
  const bytes = []
  for (let i = start; i < end; i++) bytes.push(buf[i].toString(16).padStart(2, '0'))
  return bytes.join(' ')
}

export function bytesToAscii(buf, start = 0, end = buf.length) {
  let s = ''
  for (let i = start; i < end; i++) {
    const c = buf[i]
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.'
  }
  return s
}

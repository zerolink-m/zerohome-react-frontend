// Отладочное логирование таймингов WebRTC-подключения.
// Включается переменной WEBRTC_DEBUG=true|1 в .env (пробрасывается через define в vite.config.js).
// Выключено — все функции возвращают no-op, ничего не пишется и не считается.
// Логи идут через console.log, поэтому видны и в DebugConsole (consoleCapture).

const RAW = typeof __WEBRTC_DEBUG__ !== 'undefined' ? String(__WEBRTC_DEBUG__).trim().toLowerCase() : ''
export const isWebrtcDebug = RAW === 'true' || RAW === '1'

const noop = () => {}
const NOOP_TRACE = {
  enabled: false,
  log: noop,
  stage: noop,
  request: (_method, _url, _opts, fn) => fn(),
  fetch: (url, opts) => fetch(url, opts),
  summary: noop,
  end: noop,
}

let activeTrace = null

// Текущая трасса (для кода вне плеера: api/client, VideoStreamUniversal). null, если выключено/нет попытки.
export function getActiveTrace() {
  return isWebrtcDebug ? activeTrace : null
}

// Короткий лог вне конкретной трассы (например, автопереподключение между попытками).
export function webrtcLog(event, details) {
  if (!isWebrtcDebug) return
  if (activeTrace) activeTrace.log(event, details)
  else console.log(`[WEBRTC] ${event}${fmtDetails(details)}`)
}

// fetch с логированием, если сейчас идёт трассируемая попытка; иначе обычный fetch без накладных расходов.
export function tracedFetch(url, opts) {
  const tr = getActiveTrace()
  return tr ? tr.fetch(url, opts) : fetch(url, opts)
}

export function maskUrl(url) {
  return String(url).replace(/([?&](?:token|access_token|key|secret|password)=)[^&#]*/gi, '$1***')
}

function maskText(s) {
  return maskUrl(String(s))
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1***')
    .replace(/("(?:token|access_token|credential|password|secret)"\s*:\s*")[^"]*/gi, '$1***')
}

function trunc(s, n = 200) {
  s = String(s)
  return s.length > n ? `${s.slice(0, n)}…(+${s.length - n})` : s
}

function fmtDetails(d) {
  if (d === undefined || d === null || d === '') return ''
  if (typeof d === 'string') return `: ${maskText(d)}`
  try {
    return `: ${maskText(JSON.stringify(d))}`
  } catch {
    return `: ${String(d)}`
  }
}

// Ключевые строки SDP вместо полного дампа.
export function shortSdp(sdp) {
  if (!sdp) return ''
  const lines = String(sdp).split(/\r?\n/)
  const keys = lines.filter((l) => /^(m=|a=(ice-ufrag|setup|rtpmap|fingerprint|candidate))/.test(l))
  return `len=${sdp.length}, строк=${lines.length}, ключевые: ${trunc(keys.slice(0, 6).join(' | '), 200)}`
}

export function describeCandidate(c) {
  if (!c) return 'end-of-candidates'
  return `${c.type || '?'} ${c.protocol || '?'} ${c.address || '?'}:${c.port ?? '?'}`
}

export function createWebrtcTrace(label = '') {
  if (!isWebrtcDebug) return NOOP_TRACE

  const t0 = performance.now()
  let last = t0
  let maxGap = { ms: 0, from: '', to: '' }
  let lastEvent = 'старт'
  const stageNames = {}
  const stageStart = {}
  let curStage = null
  const durations = []
  let ended = false
  let reqSeq = 0

  const tag = label ? `${label} ` : ''
  const emit = (event, details) => {
    const now = performance.now()
    const total = Math.round(now - t0)
    const delta = Math.round(now - last)
    if (now - last > maxGap.ms) maxGap = { ms: now - last, from: lastEvent, to: event }
    last = now
    lastEvent = event
    console.log(`[WEBRTC ${tag}+${total}ms Δ${delta}ms] ${event}${fmtDetails(details)}`)
  }

  const closeStage = (now) => {
    if (curStage !== null) durations.push({ n: curStage, name: stageNames[curStage], ms: now - stageStart[curStage] })
    curStage = null
  }

  const trace = {
    enabled: true,
    log: emit,

    stage(n, name) {
      const now = performance.now()
      closeStage(now)
      stageNames[n] = name
      stageStart[n] = now
      curStage = n
      emit(`этап ${n} → ${name}`)
    },

    // Обёртка произвольного запроса: fn() возвращает Promise; лог отправки, ответа и длительности.
    // opts.describe(result) → строка с кратким описанием ответа (необязательно).
    async request(method, url, opts, fn) {
      const id = ++reqSeq
      const s = performance.now()
      emit(`запрос #${id} отправлен`, `${method} ${maskUrl(url)}`)
      try {
        const res = await fn()
        const d = opts?.describe ? opts.describe(res) : ''
        emit(`запрос #${id} получен`, `${method} ${maskUrl(url)} за ${Math.round(performance.now() - s)}ms${d ? ` ${d}` : ''}`)
        return res
      } catch (e) {
        emit(`запрос #${id} ОШИБКА`, `${method} ${maskUrl(url)} за ${Math.round(performance.now() - s)}ms: ${e?.message || e}`)
        throw e
      }
    },

    // fetch с логированием статуса и усечённого тела (читается из clone).
    async fetch(url, opts = {}) {
      const method = opts.method || 'GET'
      const id = ++reqSeq
      const s = performance.now()
      emit(`fetch #${id} отправлен`, `${method} ${maskUrl(url)}`)
      try {
        const res = await fetch(url, opts)
        const headMs = Math.round(performance.now() - s)
        let body = ''
        try {
          const text = await res.clone().text()
          body = ` размер=${text.length}B тело=${trunc(maskText(text), 200)}`
        } catch { /* тело недоступно */ }
        emit(`fetch #${id} получен`, `${method} ${maskUrl(url)} статус=${res.status} заголовки за ${headMs}ms, всего ${Math.round(performance.now() - s)}ms${body}`)
        return res
      } catch (e) {
        emit(`fetch #${id} ОШИБКА`, `${method} ${maskUrl(url)} за ${Math.round(performance.now() - s)}ms: ${e?.message || e}`)
        throw e
      }
    },

    // Итоговая таблица этапов. Вызывать один раз по готовности.
    summary() {
      if (ended) return
      ended = true
      const now = performance.now()
      closeStage(now)
      emit('ГОТОВО, сводка')
      const rows = durations.map((d) => ({ name: `${d.n}: ${d.name}`, ms: Math.round(d.ms) }))
      rows.push({ name: 'ИТОГО', ms: Math.round(now - t0) })
      const text = rows.map((r) => `  ${r.name.padEnd(34)} ${String(r.ms).padStart(6)} ms`).join('\n')
      console.log(`[WEBRTC ${tag}сводка]\n${text}\n  макс. пауза между событиями: ${Math.round(maxGap.ms)}ms (между «${maxGap.from}» и «${maxGap.to}»)`)
    },

    end() {
      if (activeTrace === trace) activeTrace = null
    },
  }

  activeTrace = trace
  return trace
}

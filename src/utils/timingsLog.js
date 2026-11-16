// Логи таймингов загрузки: что и когда загрузилось и из кэша ли.
// Включается VITE_TIMINGS_LOGGING=true|1 в .env (нужна пересборка). Выключено — все функции no-op
// (код остаётся в бандле, но не выполняется). Строки идут через console.log, их видно в DebugConsole.
// Формат: [TIMING +1234ms Δ56ms] тип: что — детали. +N от navigationStart (performance.now()), Δ от прошлой строки.
// Не пересекается с WEBRTC_DEBUG (utils/webrtcDebug.js).

const RAW = String(import.meta.env.VITE_TIMINGS_LOGGING ?? '').trim().toLowerCase()
export const isTimingsLogging = RAW === 'true' || RAW === '1'

let last = 0

export function tlog(type, what, details) {
  if (!isTimingsLogging) return
  const now = performance.now()
  const line = `[TIMING +${Math.round(now)}ms Δ${Math.round(now - last)}ms] ${type}: ${what}${details ? ` — ${details}` : ''}`
  last = now
  console.log(line)
}

const once = new Set()
export function tlogOnce(key, type, what, details) {
  if (!isTimingsLogging || once.has(key)) return
  once.add(key)
  tlog(type, what, details)
}

// Не чаще одного раза в ms для одного key.
const throttled = new Map()
export function tlogThrottled(key, ms, type, what, details) {
  if (!isTimingsLogging) return
  const now = performance.now()
  if (now - (throttled.get(key) ?? -Infinity) < ms) return
  throttled.set(key, now)
  tlog(type, what, details)
}

export function maskUrl(url) {
  return String(url)
    .replace(/([?&](?:token|access_token|key|secret|password)=)[^&#]*/gi, '$1***')
}

// Короткое имя ресурса: путь + замаскированный query без origin.
export function shortUrl(url) {
  try {
    const u = new URL(url, location.href)
    const base = u.origin === location.origin ? '' : u.origin
    return maskUrl(`${base}${u.pathname}${u.search}`)
  } catch {
    return maskUrl(url)
  }
}

export function fmtBytes(n) {
  if (n == null || Number.isNaN(n)) return '?'
  if (n < 1024) return `${n}B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)}kB`
  return `${(n / 1048576).toFixed(2)}MB`
}

// Источник ресурса по PerformanceResourceTiming.
export function classifyResource(e) {
  if (e.deliveryType === 'cache') return 'кэш браузера'
  if (e.workerStart > 0) return e.transferSize > 0 ? 'SW → сеть' : 'SW/cache'
  if (e.transferSize === 0 && e.decodedBodySize > 0) return 'кэш браузера'
  if (e.transferSize === 0 && e.decodedBodySize === 0 && e.encodedBodySize === 0) {
    // cross-origin без Timing-Allow-Origin: размеры скрыты; очень быстрый ответ — вероятно кэш
    return e.duration < 20 ? 'вероятно кэш' : 'не определён (cross-origin без Timing-Allow-Origin)'
  }
  return 'сеть'
}

function findSource(url, startedAt) {
  try {
    const abs = new URL(url, location.href).href
    const list = performance.getEntriesByName(abs).filter((e) => e.startTime >= startedAt - 5)
    const e = list[list.length - 1]
    return e ? classifyResource(e) : 'не определён'
  } catch {
    return 'не определён'
  }
}

// fetch с логом: метод, путь, статус, длительность, размер, источник. Ответ возвращается сразу,
// размер считается по clone() в фоне и не задерживает вызывающего. impl — исходная функция fetch.
export async function timedFetch(url, opts = {}, impl = fetch) {
  if (!isTimingsLogging) return impl(url, opts)
  const method = opts.method || 'GET'
  const label = `${method} ${shortUrl(url)}`
  const s = performance.now()
  try {
    const res = await impl(url, opts)
    const head = Math.round(performance.now() - s)
    res.clone().arrayBuffer().then(
      (buf) => setTimeout(() => {
        tlog('API', label, `${res.status}, ${Math.round(performance.now() - s)}ms (заголовки ${head}ms), ${fmtBytes(buf.byteLength)}, источник: ${findSource(url, s)}`)
      }, 0),
      () => tlog('API', label, `${res.status}, заголовки ${head}ms, тело не прочитано`),
    )
    return res
  } catch (e) {
    tlog('API', `${label} ОШИБКА`, `${Math.round(performance.now() - s)}ms: ${e?.message || e}`)
    throw e
  }
}

// Замер произвольного async-действия.
export async function timeAsync(type, what, fn) {
  if (!isTimingsLogging) return fn()
  const s = performance.now()
  try {
    const r = await fn()
    tlog(type, what, `${Math.round(performance.now() - s)}ms`)
    return r
  } catch (e) {
    tlog(type, `${what} ОШИБКА`, `${Math.round(performance.now() - s)}ms: ${e?.message || e}`)
    throw e
  }
}

// Для React.lazy: логирует загрузку чанка маршрута. Выключено — возвращает importer как есть.
export function timedImport(name, importer) {
  if (!isTimingsLogging) return importer
  return () => {
    const s = performance.now()
    return importer().then((m) => {
      tlog('чанк маршрута', name, `${Math.round(performance.now() - s)}ms`)
      return m
    })
  }
}

// Снимки localStorage: когда показан и когда обновлён с сервера.
const snapShown = new Map()
export function snapshotShown(key, name, ageSec) {
  if (!isTimingsLogging) return
  snapShown.set(key, performance.now())
  tlog('снимок', name, `показан из снимка${ageSec != null ? ` (возраст ${ageSec} с)` : ''}, источник: снимок`)
}
export function snapshotMiss(key, name) {
  if (!isTimingsLogging) return
  snapShown.set(key, null)
  tlog('снимок', name, 'снимка нет (промах), ждём сервер')
}
export function snapshotUpdated(key, name) {
  if (!isTimingsLogging) return
  const t = snapShown.get(key)
  tlog('снимок', name, t ? `обновлено с сервера за ${Math.round(performance.now() - t)}ms после показа снимка` : 'получено с сервера и сохранено, источник: сеть')
  snapShown.delete(key)
}

// Ресурсы страницы (JS/CSS/шрифты/картинки): PerformanceObserver. fetch/xhr логируются в timedFetch
// (здесь они только в сводке), чтобы не дублировать.
function logResource(e) {
  if (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest') return
  tlog('ресурс', `${e.initiatorType || '?'} ${shortUrl(e.name)}`, `${Math.round(e.duration)}ms, ${fmtBytes(e.transferSize || e.encodedBodySize)}, источник: ${classifyResource(e)}`)
}

function summary() {
  const list = performance.getEntriesByType('resource')
  let cache = 0, net = 0, sw = 0, unk = 0, bytes = 0
  for (const e of list) {
    const c = classifyResource(e)
    if (c === 'кэш браузера' || c === 'вероятно кэш') cache++
    else if (c.startsWith('SW')) sw++
    else if (c === 'сеть') net++
    else unk++
    bytes += e.transferSize || 0
  }
  const slow = [...list].sort((a, b) => b.duration - a.duration).slice(0, 5)
    .map((e, i) => `  ${i + 1}. ${Math.round(e.duration)}ms ${e.initiatorType} ${shortUrl(e.name)} (${classifyResource(e)})`)
  tlog('сводка ресурсов', `всего ${list.length}`, `кэш браузера ${cache}, сеть ${net}, SW ${sw}, не определено ${unk}, по сети ${fmtBytes(bytes)}`)
  console.log(`[TIMING] самые медленные 5:\n${slow.join('\n')}`)
}

// Вызвать вручную из консоли: window.__timingsSummary()
function initPageTiming() {
  try {
    const nav = performance.getEntriesByType('navigation')[0]
    if (nav) {
      tlog('страница', `${nav.name ? shortUrl(nav.name) : 'index.html'} (${nav.type})`,
        `ответ ${Math.round(nav.responseEnd)}ms, DOMContentLoaded ${Math.round(nav.domContentLoadedEventEnd)}ms, источник: ${classifyResource(nav)}`)
    }
  } catch { /* ignore */ }
  try {
    const po = new PerformanceObserver((list) => list.getEntries().forEach(logResource))
    po.observe({ type: 'resource', buffered: true })
  } catch { /* браузер не поддерживает */ }
  window.__timingsSummary = summary
  const onLoad = () => {
    tlog('этап', 'событие load')
    setTimeout(summary, 3000)
  }
  if (document.readyState === 'complete') onLoad()
  else window.addEventListener('load', onLoad, { once: true })
}

if (isTimingsLogging && typeof window !== 'undefined') {
  tlog('этап', 'старт скрипта (timingsLog загружен)')
  initPageTiming()
}

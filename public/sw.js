/* eslint-disable no-restricted-globals */
// Только публичная оболочка. API, stream, share и запросы с токенами не кэшируются.
const PREFIX = 'zc-shell-v2-'
const POINTER = 'zc-shell-v2-pointer'
const CHECK_MS = 15 * 60 * 1000
let lastCheck = 0
let checking = null

function allowed(url) {
  return url.origin === self.location.origin &&
    (/^\/assets\//.test(url.pathname) || /^\/icons\//.test(url.pathname) || url.pathname === '/manifest.webmanifest') &&
    !url.searchParams.has('token')
}

async function activeName() {
  const response = await (await caches.open(POINTER)).match('/__active__')
  return response?.text() || null
}

async function setActive(name) {
  await (await caches.open(POINTER)).put('/__active__', new Response(name))
}

// Проходим транзитивно по импортам JS, url() CSS и ссылкам HTML: shell считается
// готовым только после успешной загрузки каждого файла, включая lazy chunks.
async function stageHtml(html) {
  const data = new TextEncoder().encode(html)
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data))).map(x => x.toString(16).padStart(2, '0')).join('')
  const name = PREFIX + hash
  if (name === await activeName()) return null
  const cache = await caches.open(name)
  const visited = new Set()
  try {
    async function visit(text, base) {
      // Rolldown может записывать пути к чанкам в обратных кавычках.
      const re = /["'(`]\s*(\/assets\/[^"'()`{}\s]+|(?:\.\.?\/)[^"'()`{}\s]+\.(?:js|css|woff2?|png|svg|jpg|webp|ico))\s*["')`]/g
      for (const match of text.matchAll(re)) {
        const url = new URL(match[1], base)
        if (!allowed(url) || visited.has(url.href)) continue
        visited.add(url.href)
        const response = await fetch(url.href, { cache: 'no-store' })
        if (!response.ok) throw new Error(`Missing build asset: ${url.pathname}`)
        await cache.put(url.href, response.clone())
        if (/\.(?:js|css)$/.test(url.pathname)) await visit(await response.text(), url.href)
      }
    }
    await visit(html, self.location.origin + '/index.html')
    await cache.put('/index.html', new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
    return name
  } catch (error) {
    await caches.delete(name)
    throw error
  }
}

async function checkUpdate() {
  if (checking) return checking
  checking = (async () => {
    const res = await fetch('/index.html', { cache: 'no-store' })
    if (!res.ok) throw new Error('Shell unavailable')
    const staged = await stageHtml(await res.text())
    if (!staged) return
    if (!await activeName()) {
      await setActive(staged)
      return
    }
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const client of clients) client.postMessage({ type: 'UPDATE_READY', name: staged })
  })().finally(() => { checking = null })
  return checking
}

self.addEventListener('install', event => {
  event.waitUntil(checkUpdate())
  // Никакого skipWaiting без явного действия пользователя.
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Перехватываем открытые вкладки только после явного «Обновить сейчас».
    const cache = await caches.open(POINTER)
    if (await cache.match('/__approved__')) {
      await cache.delete('/__approved__')
      await self.clients.claim()
    }
  })())
})
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil((async () => {
      // Маркер переживает перезапуск worker между ожиданием и активацией.
      await (await caches.open(POINTER)).put('/__approved__', new Response('yes'))
      await self.skipWaiting()
    })())
  } else if (event.data?.type === 'CHECK_UPDATE') {
    event.waitUntil(checkUpdate().catch(() => {}))
  } else if (event.data?.type === 'APPLY_UPDATE') {
    event.waitUntil((async () => {
      const name = event.data.name
      if (!name?.startsWith(PREFIX) || !(await caches.has(name)) || !(await (await caches.open(name)).match('/index.html'))) return
      await setActive(name)
      event.source?.postMessage({ type: 'UPDATE_APPLIED', name })
    })())
  }
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  const url = new URL(req.url)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const name = await activeName()
      const cached = name && await (await caches.open(name)).match('/index.html')
      if (cached) {
        if (Date.now() - lastCheck > CHECK_MS) {
          lastCheck = Date.now()
          event.waitUntil(checkUpdate().catch(() => {}))
        }
        return cached
      }
      // Первое посещение / очищенный кэш: сеть обязательна; не выдаём неполный shell.
      return fetch(req)
    })())
  } else if (allowed(url)) {
    event.respondWith((async () => {
      const name = await activeName()
      const cached = name && await (await caches.open(name)).match(req)
      return cached || fetch(req)
    })())
  }
})

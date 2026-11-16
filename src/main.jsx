import { tlog } from './utils/timingsLog'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/syne/700.css'
import './styles/global.css'

// Инициализируем перехват консоли до всего остального
import './utils/consoleCapture'

import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { HealthProvider } from './context/HealthContext'
import { ThemeProvider } from './context/ThemeContext'
import App from './App'

tlog('этап', 'main.jsx: модули загружены, вызываем render')
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <HealthProvider>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </HealthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)

// Обновление только по согласию. Новый worker сначала полностью скачивает HTML и
// дерево hashed assets; старый shell продолжает работать до нажатия кнопки.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const v = encodeURIComponent(import.meta.env.VITE_APP_VERSION || 'dev')
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`/sw.js?v=${v}`)
      let pending = null
      let applying = false

      // Сравниваем с HTML, который реально исполняется, а не с указателем SW:
      // при переходе со старого worker указатель может отставать от открытой страницы.
      const isDifferent = (html) => {
        const next = new DOMParser().parseFromString(html, 'text/html')
        const selectors = ['script[type="module"][src]', 'link[rel="stylesheet"]', 'title', 'meta', 'script:not([src])']
        return selectors.some(selector => {
          const current = [...document.head.querySelectorAll(selector)].map(el => el.outerHTML)
          const incoming = [...next.head.querySelectorAll(selector)].map(el => el.outerHTML)
          return JSON.stringify(current) !== JSON.stringify(incoming)
        })
      }
      const latestHtml = async () => {
        const response = await fetch('/index.html', { cache: 'no-store' })
        if (!response.ok) throw new Error('Не удалось проверить новую версию')
        return response.text()
      }
      const nameFor = async (html) => {
        const bytes = new TextEncoder().encode(html)
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
          .map(byte => byte.toString(16).padStart(2, '0')).join('')
        return `zc-shell-v2-${hash}`
      }
      const show = (apply) => {
        if (pending) pending.remove()
        const box = document.createElement('div')
        box.setAttribute('role', 'status')
        box.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;max-width:420px;margin:auto;z-index:99999;padding:16px;border-radius:12px;background:#171b29;color:#fff;box-shadow:0 6px 25px #0008;font:14px sans-serif'
        box.append('Доступна новая версия. ')
        const button = document.createElement('button')
        button.textContent = 'Обновить сейчас'
        button.style.cssText = 'margin:4px;padding:8px;cursor:pointer'
        button.onclick = async () => {
          if (applying) return
          applying = true
          button.disabled = true
          button.textContent = 'Обновляем…'
          try {
            await apply()
            location.reload()
          } catch (err) {
            console.warn('Не удалось применить обновление', err)
            button.disabled = false
            button.textContent = 'Повторить обновление'
            applying = false
          }
        }
        box.append(button)
        const later = document.createElement('button')
        later.textContent = 'Позже'
        later.style.cssText = 'margin:4px;padding:8px;cursor:pointer'
        later.onclick = () => { box.remove(); pending = null }
        box.append(later)
        document.body.append(box)
        pending = box
      }
      const applyTo = (worker, name) => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { cleanup(); reject(new Error('Worker не подтвердил обновление')) }, 8000)
        const onMessage = (event) => {
          // Worker из предыдущей сборки подтверждал применение без поля name.
          if (event.source !== worker || event.data?.type !== 'UPDATE_APPLIED' || (event.data.name && event.data.name !== name)) return
          cleanup()
          resolve()
        }
        const cleanup = () => {
          clearTimeout(timeout)
          navigator.serviceWorker.removeEventListener('message', onMessage)
        }
        navigator.serviceWorker.addEventListener('message', onMessage)
        worker.postMessage({ type: 'APPLY_UPDATE', name })
      })
      const activate = (worker) => new Promise((resolve, reject) => {
        if (worker.state === 'activated') { resolve(); return }
        const timeout = setTimeout(() => { cleanup(); reject(new Error('Worker не активировался')) }, 8000)
        const onChange = () => { if (worker.state === 'activated') { cleanup(); resolve() } }
        const cleanup = () => { clearTimeout(timeout); worker.removeEventListener('statechange', onChange) }
        worker.addEventListener('statechange', onChange)
        worker.postMessage({ type: 'SKIP_WAITING' })
      })
      const offer = async (html, name) => {
        if (!isDifferent(html)) return
        show(async () => {
          // При наличии waiting worker применять новую оболочку должен именно он.
          // Старый active worker может вообще не знать команду APPLY_UPDATE.
          const worker = registration.waiting || registration.active
          if (!worker) throw new Error('Worker недоступен')
          const staged = await caches.open(name).then(cache => cache.match('/index.html'))
          if (!staged) throw new Error('Новая версия ещё не скачана')
          await applyTo(worker, name)
          if (worker.state === 'installed') await activate(worker)
        })
      }
      const waiting = async () => {
        if (!registration.waiting || !navigator.serviceWorker.controller) return
        try {
          const html = await latestHtml()
          await offer(html, await nameFor(html))
        } catch (err) { console.warn('Не удалось проверить обновление', err) }
      }
      waiting()
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', waiting)
      })
      navigator.serviceWorker.addEventListener('message', async event => {
        if (event.data?.type !== 'UPDATE_READY' || !event.data.name) return
        try {
          const cached = await caches.open(event.data.name).then(cache => cache.match('/index.html'))
          if (cached) await offer(await cached.text(), event.data.name)
        } catch (err) { console.warn('Не удалось проверить обновление', err) }
      })
      const check = () => registration.active?.postMessage({ type: 'CHECK_UPDATE' })
      check()
      const timer = setInterval(check, 15 * 60 * 1000)
      window.addEventListener('beforeunload', () => clearInterval(timer), { once: true })
    } catch (err) {
      console.warn('SW registration failed', err)
    }
  })
}

import { useSyncExternalStore } from 'react'

// Реальные этапы обычных запросов к бэкенду (api/client.js: request / fetchAuthorizedBlob).
// Каждый запрос в полёте имеет этап: 0 — запрос отправлен (ждём ответ сервера),
// 1 — ответ получен (разбор данных). Общий снимок: active — есть ли запросы в полёте,
// stage — наименьший этап среди них (загрузка завершена, когда ушёл последний запрос).
let nextId = 1
const inflight = new Map()
const listeners = new Set()
let snapshot = { active: false, stage: 0 }

function recompute() {
  let stage = 2
  for (const s of inflight.values()) stage = Math.min(stage, s)
  const next = inflight.size ? { active: true, stage } : { active: false, stage: 0 }
  if (next.active !== snapshot.active || next.stage !== snapshot.stage) {
    snapshot = next
    for (const fn of listeners) fn()
  }
}

export function trackRequest() {
  const id = nextId++
  inflight.set(id, 0)
  recompute()
  return {
    responded() {
      if (inflight.has(id)) {
        inflight.set(id, 1)
        recompute()
      }
    },
    end() {
      inflight.delete(id)
      recompute()
    },
  }
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useNetStage() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}

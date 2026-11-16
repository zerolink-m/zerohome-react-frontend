import { useSyncExternalStore } from 'react'

// Счётчик обновления главного экрана (список камер/выключателей/соединений).
// Клик по логотипу на «/» увеличивает счётчик; DashboardPage по смене ключа перемонтирует секции
// и они заново запрашивают данные (снимки localStorage лишь показываются до ответа сервера).
let refreshKey = 0
const listeners = new Set()

export function refreshDashboard() {
  refreshKey += 1
  for (const fn of listeners) fn()
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useDashboardRefreshKey() {
  return useSyncExternalStore(subscribe, () => refreshKey, () => refreshKey)
}

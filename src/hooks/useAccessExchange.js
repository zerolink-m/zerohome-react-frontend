import { useSyncExternalStore } from 'react'
import { getExchange, subscribeExchange } from '../api/authStore'

// Реальное состояние обмена session → access: { status: 'idle'|'running'|'done'|'error', stage, error }.
// Обновляется из любого пути обмена (AuthContext, таймер, 401 в client.js, «Повторить»).
export function useAccessExchange() {
  return useSyncExternalStore(subscribeExchange, getExchange, getExchange)
}

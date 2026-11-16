// Глобальное хранилище логов
const logs = []
const listeners = new Set()

// Перехватываем console методы сразу при импорте
const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn
const originalInfo = console.info

const addLog = (type, args) => {
  const timestamp = new Date().toLocaleTimeString('ru-RU', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const message = args
    .map((arg) => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2)
        } catch (e) {
          return String(arg)
        }
      }
      return String(arg)
    })
    .join(' ')

  const logEntry = { type, message, timestamp, id: Date.now() + Math.random() }
  logs.push(logEntry)

  // Ограничиваем количество логов
  if (logs.length > 500) {
    logs.shift()
  }

  // Уведомляем всех слушателей
  listeners.forEach((cb) => cb(logs))
}

console.log = (...args) => {
  originalLog(...args)
  addLog('log', args)
}

console.error = (...args) => {
  originalError(...args)
  addLog('error', args)
}

console.warn = (...args) => {
  originalWarn(...args)
  addLog('warn', args)
}

console.info = (...args) => {
  originalInfo(...args)
  addLog('info', args)
}

// API для компонентов
export const consoleCaptureAPI = {
  getLogs: () => logs,
  clearLogs: () => {
    logs.length = 0
    listeners.forEach((cb) => cb(logs))
  },
  subscribe: (callback) => {
    listeners.add(callback)
    // Сразу отдаём текущие логи
    callback(logs)
    return () => listeners.delete(callback)
  },
}

// Тестовый лог при старте
console.log('🔧 Console capture initialized')

import { request } from './client'

// Получить все статистики
export function getAllStats(period = 24) {
  return request(`/stats?period=${period}`)
}

// Системная статистика
export function getSystemStats() {
  return request('/stats/system')
}

// Статистика стримов
export function getStreamStats() {
  return request('/stats/streams')
}

// Статистика камер
export function getCameraStats() {
  return request('/stats/cameras')
}

// Статистика записей
export function getRecordingStats() {
  return request('/stats/recordings')
}

// Статистика детекции движения
export function getMotionStats(period = 24) {
  return request(`/stats/motion?period=${period}`)
}

// Статистика пользователей
export function getUserStats() {
  return request('/stats/users')
}

// Статистика ошибок
export function getErrorStats() {
  return request('/stats/errors')
}

// Статистика производительности
export function getPerformanceStats() {
  return request('/stats/performance')
}

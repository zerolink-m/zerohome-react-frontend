import { request, refreshAccessToken, wrapBody } from './client'

// Оба ответа содержат data.token — непрозрачный bearer текущей сессии.
export function register({ name, surname, email, password }) {
  return request('/auth/register', { method: 'POST', body: wrapBody('user', { name, surname, email, password }), auth: false })
}
export function login({ email, password }) {
  return request('/auth/login', { method: 'POST', body: wrapBody('credentials', { email, password }), auth: false })
}
// Только для однократной миграции старого session JWT.
export function exchangeAccess(onStage) { return refreshAccessToken({ onStage }) }
export function logout() { return request('/auth/logout', { method: 'POST' }) }

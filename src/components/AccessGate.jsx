import { useAuth } from '../context/AuthContext'
import AccessWait from './AccessProgress'

// Страницы, которым access-токен нужен синхронно (URL с ?token=, WebSocket, заголовки плеера),
// открываются сразу, но содержимое показывают только когда токен получен.
// Пока токена нет — анимация этапов обмена (с задержкой 300 мс), при ошибке — «Повторить».
export default function AccessGate({ children }) {
  const { accessToken } = useAuth()
  return <AccessWait waiting={!accessToken}>{children}</AccessWait>
}

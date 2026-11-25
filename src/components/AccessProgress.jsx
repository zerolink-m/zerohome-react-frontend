import { useEffect, useState } from 'react'
import { exchangeAccess } from '../api/auth'
import { ACCESS_STAGE_COUNT, getLegacyToken } from '../api/authStore'
import { useAccessExchange } from '../hooks/useAccessExchange'
import { useStagedLoader } from '../hooks/useStagedLoader'
import StageProgress from './StageProgress'
import Button from './Button'
import { colors } from '../styles/tokens'

const STAGES = ['Старый токен найден', 'Запрос обмена отправлен', 'Ответ сервера получен', 'Новый токен сохранён']

// Ожидание access-токена: пока waiting — рисуем анимацию этапов по реальному состоянию обмена
// (authStore.getExchange). Показ с задержкой 300 мс (быстрый ответ — не показываем вовсе). После получения
// токена анимация доходит до финала, держится ~350 мс, плавно скрывается, и только затем рендерятся children.
// Ошибка обмена показывается сразу, с кнопкой «Повторить».
export default function AccessWait({ waiting, children = null }) {
  const ex = useAccessExchange()
  const failed = ex.status === 'error'
  const target = ex.status === 'done' ? ACCESS_STAGE_COUNT : ex.stage
  const { visible, leaving, shown } = useStagedLoader(waiting, target, ACCESS_STAGE_COUNT, { showDelay: failed ? 0 : 300 })

  // Если обмен никто не запустил — запускаем; дубли исключены общим promise в client.js.
  const [retrying, setRetrying] = useState(false)
  useEffect(() => {
    if (waiting && ex.status === 'idle' && getLegacyToken()) exchangeAccess().catch(() => {})
  }, [waiting, ex.status])

  function retry() {
    setRetrying(true)
    exchangeAccess()
      .catch(() => {})
      .finally(() => setRetrying(false))
  }

  const showError = failed && waiting
  if (!visible) {
    // Индикатор ещё не показан (задержка 300 мс) — пока токена нет, ничего не рисуем; иначе контент.
    return waiting ? null : children
  }

  const failedIndex = showError && shown >= ex.stage ? ex.stage : null
  const activeIndex = shown

  return (
    <div className="sp-box sp-fade" style={{ opacity: leaving ? 0 : 1 }}>
      <StageProgress steps={STAGES} active={activeIndex} failedIndex={failedIndex} label="Обновление сессии" />
      {failedIndex != null && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <div role="alert" style={{ fontSize: '0.8125rem', color: colors.statuses.red.text, marginBottom: 14, overflowWrap: 'anywhere' }}>
            {ex.error || 'Не удалось получить токен'}
          </div>
          <Button small onClick={retry} loading={retrying}>
            Повторить
          </Button>
        </div>
      )}
    </div>
  )
}

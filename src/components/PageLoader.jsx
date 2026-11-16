import { useLoadGate } from '../hooks/useLoadGate'
import StageProgress from './StageProgress'
import Button from './Button'
import { colors } from '../styles/tokens'

const STEPS = ['Соединение с сервером', 'Получение данных', 'Готово']

// Загрузка данных страницы/секции по реальным этапам запросов (api/netStore.js):
// «Соединение с сервером» — запрос отправлен, «Получение данных» — ответ получен, идёт разбор,
// «Готово» — данные разобраны. Центрируется в области контента.
//   loading  — идёт ли загрузка (состояние компонента)
//   error    — текст ошибки загрузки (красный этап + «Повторить»)
//   onRetry  — повтор загрузки
//   compact  — уменьшенные круги для секций внутри страницы
//   children — что показать после загрузки (необязательно; по умолчанию null)
// Показ с задержкой 300 мс; после завершения индикатор доходит до финала (все галочки), пауза ~350 мс
// (не менее 600 мс от показа), плавное скрытие, и только потом children.
//   gate     — состояние из useLoadGate (когда родитель сам решает, показывать ли контент по gate.busy)
export default function PageLoader({ gate, loading = true, error: errorProp = null, onRetry, compact = false, minHeight, children = null }) {
  // Собственный шлюз используется, если gate не передан (тогда контент передаётся как children).
  const own = useLoadGate(gate ? false : loading, gate ? null : errorProp)
  const g = gate || own
  const { visible, leaving, shown } = g
  const error = g.error

  if (!error && !visible) return gate || loading ? null : children

  // Упавший этап: сеть недоступна — соединение, иначе — получение данных.
  const failedIndex = error ? (/связаться|сет/i.test(error) ? 0 : 1) : null

  return (
    <div className={`pl-box${compact ? ' pl-compact' : ''}`} style={minHeight ? { minHeight } : undefined}>
      <div className="sp-box sp-fade" style={{ opacity: leaving && !error ? 0 : 1 }}>
        <StageProgress steps={STEPS} active={error ? failedIndex : shown} failedIndex={failedIndex} />
        {error && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <div style={{ fontSize: 13, color: colors.statuses.red.text, marginBottom: 14, overflowWrap: 'anywhere' }}>
              {error}
            </div>
            {onRetry && (
              <Button small onClick={onRetry}>
                Повторить
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

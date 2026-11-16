import { useStagedLoader } from '../../hooks/useStagedLoader'
import StageProgress from '../StageProgress'
import Button from '../Button'
import { colors } from '../../styles/tokens'

// Оверлей реальных этапов подключения к стриму поверх видео (по центру).
//   steps       — подписи этапов (последний — «Готово»)
//   stage       — реальный этап (индекс 0..steps.length-1), меняется по событиям плеера
//   finished    — стрим пошёл (первый кадр / playing): оверлей доводится до финала и плавно скрывается
//   error       — текст ошибки: красный этап failedStage + «Повторить»
//   onRetry     — переподключение
// Использует тот же useStagedLoader: показ с задержкой 300 мс, шаги по 120 мс, пауза 150 мс, fade 200 мс.
export default function StreamStages({ steps, stage, finished, error, failedStage, onRetry }) {
  const { visible, leaving, shown } = useStagedLoader(!finished && !error, stage, steps.length)

  if (!error && !visible) return null

  const failedIndex = error ? Math.min(failedStage ?? stage, steps.length - 1) : null

  return (
    <div
      className="sp-fade"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.82)',
        opacity: leaving && !error ? 0 : 1,
        pointerEvents: error ? 'auto' : 'none',
        overflow: 'auto',
      }}
    >
      <div className="pl-compact" style={{ width: '100%', maxWidth: 520, padding: '0 12px', boxSizing: 'border-box' }}>
        <div className="sp-box" style={{ padding: '12px 8px' }}>
          <StageProgress steps={steps} active={error ? failedIndex : shown} failedIndex={failedIndex} />
          {error && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <div style={{ fontSize: 12, color: colors.statuses.red.text, marginBottom: 12, overflowWrap: 'anywhere' }}>
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
    </div>
  )
}

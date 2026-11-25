// Горизонтальный индикатор этапов: ---(1)---(2)---(3)---
// Вращается только кольцо активного этапа, содержимое круга (номер/галочка) неподвижно.
// Стили — в global.css (.sp-*), там же prefers-reduced-motion.
//   steps       — массив подписей
//   active      — индекс активного этапа; >= steps.length — все завершены
//   failedIndex — индекс упавшего этапа (красный, без вращения) или null
export default function StageProgress({ steps, active, failedIndex = null, label = 'Ход загрузки' }) {
  const failed = failedIndex != null
  const stage = Math.max(0, Math.min(active, steps.length))
  const stageText = failed ? `Ошибка на этапе: ${steps[failedIndex] || 'получение данных'}` : steps[stage] || 'Завершено'
  return (
    <div className="sp-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={stage} aria-valuetext={stageText}>
      {steps.map((label, i) => {
        const isFailed = failed && i === failedIndex
        const isDone = !failed ? i < active : i < failedIndex
        const isActive = !failed && i === active
        const state = isFailed ? 'failed' : isDone ? 'done' : isActive ? 'active' : 'pending'
        return (
          <div key={label} className="sp-seg">
            {i > 0 && (
              <div className="sp-line" aria-hidden="true">
                <div className="sp-line-fill" style={{ transform: `scaleX(${(failed ? i <= failedIndex : active >= i) ? 1 : 0})` }} />
              </div>
            )}
            <div className={`sp-step sp-${state}`}>
              <div className="sp-circle">
                {isActive && <span className="sp-ring" aria-hidden="true" />}
                <span className="sp-content">{isFailed ? '✕' : isDone ? '✓' : i + 1}</span>
              </div>
              <div className="sp-label">{label}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

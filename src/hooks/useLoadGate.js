import { useEffect, useRef } from 'react'
import { useNetStage } from '../api/netStore'
import { tlog, isTimingsLogging } from '../utils/timingsLog'
import { useStagedLoader } from './useStagedLoader'

// Шлюз загрузки данных: busy = true, пока идёт загрузка, есть ошибка ИЛИ индикатор ещё доигрывает финал
// (все этапы → пауза → fade-out). Контент нужно показывать только когда busy === false.
//   const gate = useLoadGate(loading, error)
//   if (gate.busy) return <PageLoader gate={gate} onRetry={...} />
// Хук вызывается на каждом рендере безусловно (до ранних return).
export function useLoadGate(loading, error = null, total = 3) {
  const net = useNetStage()
  const target = net.active ? net.stage : 0
  const staged = useStagedLoader(!!loading && !error, target, total)
  const busy = !!loading || !!error || staged.visible
  // Тайминг: от монтирования до готовности данных (индикатор доиграл финал).
  const t0 = useRef(isTimingsLogging ? performance.now() : 0)
  useEffect(() => {
    if (!isTimingsLogging || busy || !t0.current) return
    tlog('данные страницы', `готовы ${location.pathname}`, `${Math.round(performance.now() - t0.current)}ms с монтирования`)
    t0.current = 0
  }, [busy])
  return { busy, error, ...staged }
}

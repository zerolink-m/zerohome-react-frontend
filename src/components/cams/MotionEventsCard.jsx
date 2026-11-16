import { useEffect, useState } from 'react'
import { getMotionStatus } from '../../api/cams'
import DashCard from '../DashCard'
import MotionEventsList from './MotionEventsList'

// Карточка событий движения на главной странице камеры.
// Показывается только если у камеры включена детекция; иначе (или при ошибке статуса) не рендерится.
export default function MotionEventsCard({ camId }) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMotionStatus(camId)
      .then((s) => {
        if (!cancelled) setActive(!!s?.is_active)
      })
      .catch(() => {
        if (!cancelled) setActive(false)
      })
    return () => {
      cancelled = true
    }
  }, [camId])

  if (!active) return null
  return (
    <DashCard>
      <MotionEventsList camId={camId} />
    </DashCard>
  )
}

import { useEffect, useRef, useState } from 'react'

// Антимигание индикатора: показываем только если ожидание длится дольше showDelay мс,
// а уже показанный держим не меньше minVisible мс.
export function useDelayedVisible(active, showDelay = 300, minVisible = 600) {
  const [visible, setVisible] = useState(false)
  const shownAt = useRef(0)

  useEffect(() => {
    if (active && !visible) {
      const t = setTimeout(() => {
        shownAt.current = Date.now()
        setVisible(true)
      }, showDelay)
      return () => clearTimeout(t)
    }
    if (!active && visible) {
      const left = Math.max(0, minVisible - (Date.now() - shownAt.current))
      const t = setTimeout(() => setVisible(false), left)
      return () => clearTimeout(t)
    }
  }, [active, visible, showDelay, minVisible])

  return visible
}

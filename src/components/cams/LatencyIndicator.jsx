import { useEffect, useState } from 'react'

// Задержка видео: зелёный < 1 с, оранжевый < 5 с, красный ≥ 5 с.
function levelColor(seconds) {
  if (seconds < 1) return 'var(--status-green-text)'
  if (seconds < 5) return 'var(--accent-orange-text)'
  return 'var(--status-red-text)'
}

// Значение приходит снаружи через setterRef.current(value): так перерисовывается только индикатор,
// а не весь плеер. value = null — задержка неизвестна (индикатор скрыт).
export default function LatencyIndicator({ setterRef, overlay = false }) {
  const [value, setValue] = useState(null)

  useEffect(() => {
    setterRef.current = setValue
    return () => {
      setterRef.current = null
    }
  }, [setterRef])

  if (value == null) return null

  const text = (
    <>
      Задержка видео: <strong>{value.toFixed(2)}</strong> сек.
    </>
  )
  const base = {
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    color: levelColor(value),
  }

  if (overlay) {
    return (
      <div
        style={{
          ...base,
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 40,
          background: 'rgba(0,0,0,0.65)',
          borderRadius: 6,
          padding: '3px 8px',
          pointerEvents: 'none',
        }}
      >
        {text}
      </div>
    )
  }
  return <div style={{ ...base, marginBottom: 8 }}>{text}</div>
}

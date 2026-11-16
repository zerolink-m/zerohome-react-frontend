import { useEffect, useState } from 'react'
import Button from './Button'
import { colors } from '../styles/tokens'

// Пагинация с сохранением позиции скролла:
// клик по «вперёд/назад/limit» может привести к тому, что список ненадолго
// пустеет (пока идёт fetch), высота страницы схлопывается и браузер откручивает
// viewport вверх. Мы снимаем scrollY на момент клика, а затем в течение
// небольшого окна (~600мс, несколько кадров) восстанавливаем позицию — пока
// новый контент не отрисуется, clamp'ясь по фактической высоте документа.
export default function Pagination({ offset, limit, total, onChange }) {
  const page = Math.floor(offset / limit) + 1
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const canPrev = offset > 0
  const canNext = offset + limit < total

  const [restoreToken, setRestoreToken] = useState(null) // { targetY, deadline }

  useEffect(() => {
    if (!restoreToken) return
    let raf
    function tick() {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      const y = Math.min(restoreToken.targetY, maxScroll)
      if (Math.abs(window.scrollY - y) > 1) {
        window.scrollTo({ top: y, behavior: 'auto' })
      }
      if (performance.now() < restoreToken.deadline) {
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => raf && cancelAnimationFrame(raf)
  }, [restoreToken])

  function requestChange(patch) {
    setRestoreToken({ targetY: window.scrollY, deadline: performance.now() + 600 })
    onChange(patch)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
      <Button small disabled={!canPrev} onClick={() => requestChange({ offset: Math.max(0, offset - limit) })}>
        ← назад
      </Button>
      <span style={{ fontSize: 12, color: colors.white[4] }}>
        стр. {page} / {pageCount} · всего {total}
      </span>
      <Button small disabled={!canNext} onClick={() => requestChange({ offset: offset + limit })}>
        вперёд →
      </Button>
      <select
        value={limit}
        onChange={(e) => requestChange({ offset: 0, limit: Number(e.target.value) })}
        style={{
          background: 'var(--w05)',
          border: '1px solid var(--w10)',
          borderRadius: 10,
          color: 'var(--text)',
          fontSize: 12,
          padding: '6px 10px',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {[10, 25, 50, 100, 255].map((n) => (
          <option key={n} value={n} style={{ background: 'var(--bg)' }}>
            {n} / стр.
          </option>
        ))}
      </select>
    </div>
  )
}

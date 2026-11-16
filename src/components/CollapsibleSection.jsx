import { useState } from 'react'
import { colors } from '../styles/tokens'

// Сворачиваемая секция с ленивой загрузкой содержимого.
// Пока секция свёрнута — children не рендерятся, а onOpen не вызывается,
// поэтому запросы (сессии/приглашения) уходят только при первом раскрытии.
//
// props:
//   title       — заголовок
//   defaultOpen — начальное состояние (по умолчанию свёрнута)
//   count       — необязательный счётчик/бейдж справа от заголовка
//   onOpen      — вызывается один раз при первом раскрытии (загрузка данных)
export default function CollapsibleSection({ title, defaultOpen = false, count, onOpen, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const [loaded, setLoaded] = useState(defaultOpen)

  function toggle() {
    setOpen((prev) => {
      const next = !prev
      if (next && !loaded) {
        setLoaded(true)
        if (onOpen) onOpen()
      }
      return next
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 0,
          fontFamily: 'inherit',
          marginBottom: open ? 16 : 0,
          width: '100%',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13, color: colors.white[4], width: 14, display: 'inline-block' }}>
          {open ? '▾' : '▸'}
        </span>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{title}</span>
        {count != null && (
          <span style={{ fontSize: 12, color: colors.white[4] }}>({count})</span>
        )}
      </button>

      {open && loaded && <div>{children}</div>}
    </div>
  )
}
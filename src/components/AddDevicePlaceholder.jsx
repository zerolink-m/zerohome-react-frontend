import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import T, { colors } from '../styles/tokens'

// Карточка-плейсхолдер для добавления нового устройства.
// Рендерится как последний элемент внутри сетки карточек списка (см. DeviceSection).
//
// props:
//   createTo   — путь навигации ('/switches/new', '/connections/new', ...)
//   createText — подпись под "+"
//   addOptions — если задан массив { label, protoKey }, клик открывает меню
//                с этими вариантами. Выбор → navigate(`${createTo}?proto=${protoKey}`).
//                Если не задан — обычная навигация на createTo.
export default function AddDevicePlaceholder({ createTo, createText, addOptions }) {
  const navigate = useNavigate()
  const [hover, setHover] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef(null)

  const hasMenu = Array.isArray(addOptions) && addOptions.length > 0

  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  function handleClick() {
    if (hasMenu) {
      setMenuOpen((v) => !v)
    } else {
      navigate(createTo)
    }
  }

  return (
    <div ref={ref} style={{ minWidth: 0, minHeight: 120 }}>
      <div
        onClick={handleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          ...T.dashCard,
          background: 'transparent',
          border: `1px dashed ${hover ? colors.white[3] : colors.white[15]}`,
          borderRadius: 24,
          padding: 24,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 120,
          color: hover ? colors.white[7] : colors.white[4],
          transition: '0.25s ease',
          boxShadow: 'none',
          backdropFilter: 'none',
        }}
      >
        <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 8 }}>+</div>
        <div style={{ fontSize: 12, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
          {createText}
        </div>
      </div>

      {hasMenu && (
        // Меню в потоке (не поверх соседей): раскрытие двигает нижние элементы, а не перекрывает их.
        // Анимация высоты через grid-template-rows 0fr → 1fr.
        <div
          aria-hidden={!menuOpen}
          style={{
            display: 'grid',
            gridTemplateRows: menuOpen ? '1fr' : '0fr',
            opacity: menuOpen ? 1 : 0,
            transition: 'grid-template-rows 0.25s ease, opacity 0.2s ease',
            pointerEvents: menuOpen ? 'auto' : 'none',
          }}
        >
          <div style={{ overflow: 'hidden', minHeight: 0 }}>
            <div
              style={{
                marginTop: 6,
                background: 'var(--card-bg)',
                border: `1px solid ${colors.white[8]}`,
                borderRadius: 14,
                backdropFilter: 'blur(20px)',
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {addOptions.map((opt) => (
                <button
                  key={opt.protoKey}
                  type="button"
                  tabIndex={menuOpen ? 0 : -1}
                  onClick={() => {
                    setMenuOpen(false)
                    navigate(`${createTo}?proto=${encodeURIComponent(opt.protoKey)}`)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    padding: '10px 12px',
                    textAlign: 'left',
                    borderRadius: 10,
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                    transition: '0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--w06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

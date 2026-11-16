import { useState, useEffect, useRef } from 'react'
import { colors } from '../styles/tokens'
import { consoleCaptureAPI } from '../utils/consoleCapture'

export default function DebugConsole() {
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState(() => consoleCaptureAPI.getLogs())
  const logContainerRef = useRef(null)

  useEffect(() => {
    // Подписываемся на обновления логов
    const unsubscribe = consoleCaptureAPI.subscribe((newLogs) => {
      setLogs([...newLogs])
    })

    return unsubscribe
  }, [])

  // Автоскролл вниз при новых логах
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  const getLogColor = (type) => {
    switch (type) {
      case 'error':
        return '#ff6b6b'
      case 'warn':
        return '#feca57'
      case 'info':
        return '#48dbfb'
      default:
        return colors.white[1]
    }
  }

  const clearLogs = () => {
    consoleCaptureAPI.clearLogs()
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {isOpen && (
        <div
          style={{
            width: '90vw',
            maxWidth: 800,
            height: 400,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: 0,
            marginRight: 16,
          }}
        >
          {/* Заголовок */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: colors.white[1] }}>Console Debug</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={clearLogs}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: 4,
                  color: colors.white[2],
                  cursor: 'pointer',
                }}
              >
                Очистить
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: 4,
                  color: colors.white[2],
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Контейнер логов */}
          <div
            ref={logContainerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 12,
              fontSize: 11,
              fontFamily: 'monospace',
              userSelect: 'text',
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: colors.white[4], fontStyle: 'italic' }}>Консоль пуста</div>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: 8,
                    padding: '4px 8px',
                    borderLeft: `3px solid ${getLogColor(log.type)}`,
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 2,
                    wordBreak: 'break-word',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginBottom: 2,
                    }}
                  >
                    <span style={{ color: colors.white[4], fontSize: 10 }}>{log.timestamp}</span>
                    <span
                      style={{
                        color: getLogColor(log.type),
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      {log.type}
                    </span>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      color: colors.white[1],
                      whiteSpace: 'pre-wrap',
                      fontSize: 11,
                    }}
                  >
                    {log.message}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Кнопка DEBUG */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          margin: 16,
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 600,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: 6,
          color: colors.white[1],
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
        }}
      >
        DEBUG {logs.length > 0 && `(${logs.length})`}
      </button>
    </div>
  )
}

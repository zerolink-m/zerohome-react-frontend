import { useEffect, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { colors } from '../styles/tokens'

const VARIANT_MAP = { error: 'red', success: 'green', warning: 'yellow', info: 'blue' }

function ToastItem({ toast, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const scheme = colors.statuses[VARIANT_MAP[toast.type] || 'default']

  return (
    <div
      onClick={onClose}
      style={{
        background: scheme.bg,
        border: `1px solid ${scheme.border}`,
        color: scheme.text,
        borderRadius: 14,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        maxWidth: 340,
        padding: '12px 16px',
        fontSize: 12,
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: '0.35s ease',
      }}
    >
      {toast.message}
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, remove } = useToast()

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 100,
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  )
}

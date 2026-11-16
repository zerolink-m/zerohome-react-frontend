import DashCard from './DashCard'
import Button from './Button'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Удалить', onConfirm, onCancel, loading, variant = 'accent' }) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={onCancel}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <DashCard style={{ maxWidth: 380 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>{title}</h3>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 24 }}>{message}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button onClick={onCancel} disabled={loading}>
              Отмена
            </Button>
            <Button variant={variant} onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </Button>
          </div>
        </DashCard>
      </div>
    </div>
  )
}

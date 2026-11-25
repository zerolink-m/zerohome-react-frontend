import { useId } from 'react'
import DashCard from './DashCard'
import Button from './Button'
import Dialog from './Dialog'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Удалить', onConfirm, onCancel, loading, variant = 'accent' }) {
  const descriptionId = useId()

  return (
    <Dialog open={open} title={title} descriptionId={descriptionId} onClose={onCancel} blockClose={loading}>
        <DashCard style={{ maxWidth: 380 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>{title}</h3>
          <p id={descriptionId} style={{ fontSize: '0.8125rem', color: 'var(--muted-text)', marginBottom: 24 }}>{message}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-end' }}>
            <Button onClick={onCancel} disabled={loading} data-dialog-initial-focus>
              Отмена
            </Button>
            <Button variant={variant} onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </Button>
          </div>
        </DashCard>
    </Dialog>
  )
}

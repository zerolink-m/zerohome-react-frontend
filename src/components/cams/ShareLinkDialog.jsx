import { useState } from 'react'
import { createShare } from '../../api/shares'
import { describeApiError } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import DashCard from '../DashCard'
import Button from '../Button'
import { colors } from '../../styles/tokens'

const TTL_OPTIONS = [
  { label: '1 час', value: 3600 },
  { label: '2 часа', value: 7200 },
  { label: '4 часа', value: 14400 },
  { label: '8 часов', value: 28800 },
  { label: '16 часов', value: 57600 },
  { label: '24 часа', value: 86400 },
]

export default function ShareLinkDialog({ open, camId, switchId, deviceType, type, filename, onClose, sharePath, onCreated }) {
  const deviceId = camId ?? switchId
  const device_type = deviceType ?? (camId ? 'cams' : 'switches')
  const toast = useToast()
  const [ttl, setTtl] = useState(3600)
  const [creating, setCreating] = useState(false)
  const [link, setLink] = useState('')

  if (!open) return null

  async function handleCreate() {
    setCreating(true)
    try {
      const share = await createShare({ device_type, device_id: deviceId, type, filename, ttl_seconds: ttl })
      const params = new URLSearchParams({ token: share.token })
      if (type === 'record' && filename) params.set('filename', filename)
      const path =
        typeof sharePath === 'function'
          ? sharePath(deviceId)
          : sharePath ?? `/share/${type}/${deviceId}`
      setLink(`${window.location.origin}${path}?${params.toString()}`)
      if (onCreated) onCreated()
    } catch (e) {
      toast.error(describeApiError(e))
    } finally {
      setCreating(false)
    }
  }

  async function handleCopy() {
    if (!navigator.clipboard) {
      toast.error('Не удалось скопировать ссылку')
      return
    }
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Ссылка скопирована')
    } catch {
      toast.error('Не удалось скопировать ссылку')
    }
  }

  function handleClose() {
    setLink('')
    setTtl(3600)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
        padding: 16,
      }}
      onClick={handleClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <DashCard style={{ maxWidth: 420 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Поделиться ссылкой</h3>

          {!link ? (
            <>
              <div style={{ fontSize: 12, color: colors.white[4], marginBottom: 10 }}>Срок действия ссылки</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {TTL_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    small
                    variant={ttl === opt.value ? 'accent' : 'default'}
                    onClick={() => setTtl(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <Button onClick={handleClose} disabled={creating}>
                  Отмена
                </Button>
                <Button variant="accent" onClick={handleCreate} loading={creating}>
                  Создать ссылку
                </Button>
              </div>
            </>
          ) : (
            <>
              <input
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                style={{
                  width: '100%',
                  background: 'var(--w05)',
                  border: '1px solid var(--w10)',
                  borderRadius: 10,
                  color: 'var(--text)',
                  fontSize: 12,
                  padding: '8px 10px',
                  marginBottom: 16,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <Button onClick={handleClose}>Закрыть</Button>
                <Button variant="accent" onClick={handleCopy}>
                  Скопировать
                </Button>
              </div>
            </>
          )}
        </DashCard>
      </div>
    </div>
  )
}

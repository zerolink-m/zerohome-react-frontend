import { useEffect, useState } from 'react'
import { listInvitations, createInvitation, deleteInvitation } from '../../api/invitations'
import { describeApiError } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import Button from '../Button'
import InputField from '../InputField'
import Pill from '../Pill'
import ConfirmDialog from '../ConfirmDialog'
import { colors } from '../../styles/tokens'
import { useLoadGate } from '../../hooks/useLoadGate'
import PageLoader from '../PageLoader'

export default function AllowedUsersManager({ camId, switchId, deviceType }) {
  const deviceId = camId ?? switchId
  const type = deviceType ?? (camId ? 'cams' : 'switches')
  const toast = useToast()
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const gate = useLoadGate(loading)
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await listInvitations()
        // API не поддерживает фильтрацию, делаем на клиенте
        const filtered = (data.items || []).filter(
          inv => inv.device_type === type && inv.device_id === deviceId
        )
        if (!cancelled) setInvitations(filtered)
      } catch (e) {
        if (!cancelled) toast.error(describeApiError(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, type])

  async function handleInvite(e) {
    e.preventDefault()
    if (!email.trim()) return
    setInviting(true)
    try {
      const invitation = await createInvitation({ device_type: type, device_id: deviceId, email: email.trim() })
      setInvitations((list) => [...list, invitation])
      setEmail('')
      toast.success('Приглашение отправлено')
    } catch (e) {
      toast.error(describeApiError(e))
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(invId) {
    setRemoving(true)
    try {
      await deleteInvitation(invId)
      setInvitations((list) => list.filter((inv) => inv.id !== invId))
      toast.success('Доступ отозван')
    } catch (e) {
      toast.error(describeApiError(e))
    } finally {
      setRemoving(false)
      setRemoveTarget(null)
    }
  }

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: colors.white[3],
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 12,
        }}
      >
        Доступ пользователей
      </div>

      {gate.busy ? (
        <PageLoader gate={gate} compact />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {invitations.length === 0 && (
            <span style={{ fontSize: 12, color: colors.white[3] }}>Нет пользователей с доступом</span>
          )}
          {invitations.map((inv) => (
            <Pill key={inv.id} variant={inv.status === 'accepted' ? 'green' : 'blue'}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {inv.email}
                {inv.status && <span style={{ opacity: 0.7 }}>· {inv.status}</span>}
                <button
                  onClick={() => setRemoveTarget(inv)}
                  disabled={removing}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 12, padding: 0 }}
                >
                  ×
                </button>
              </span>
            </Pill>
          ))}
        </div>
      )}

      <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220 }}>
          <InputField
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email пользователя"
          />
        </div>
        <Button small type="submit" disabled={inviting}>
          Пригласить
        </Button>
      </form>

      <ConfirmDialog
        open={!!removeTarget}
        title="Убрать доступ пользователя?"
        message={`Пользователь ${removeTarget?.email} потеряет доступ к этому устройству.`}
        confirmLabel="Убрать"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => handleRemove(removeTarget.id)}
        loading={removing}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { listInvitations, createInvitation, deleteInvitation } from '../../api/invitations'
import { describeApiError } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { DEFAULT_LIMIT } from '../../api/pagination'
import Button from '../Button'
import InputField from '../InputField'
import Pill from '../Pill'
import ConfirmDialog from '../ConfirmDialog'
import Pagination from '../Pagination'
import { colors } from '../../styles/tokens'
import { useLoadGate } from '../../hooks/useLoadGate'
import PageLoader from '../PageLoader'

export default function AllowedUsersManager({ camId, switchId, deviceType }) {
  const deviceId = camId ?? switchId
  const type = deviceType ?? (camId ? 'cams' : 'switches')
  const toast = useToast()
  const [invitations, setInvitations] = useState([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState({ offset: 0, limit: DEFAULT_LIMIT })
  const [reloadTick, setReloadTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const gate = useLoadGate(loading, loadError)
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const data = await listInvitations({
          ...filter,
          search_column: ['device_type', 'device_id'],
          search_method: ['equals', 'equals'],
          search: [type, deviceId],
        })
        if (cancelled) return
        if (filter.offset > 0 && filter.offset >= data.total) {
          const offset = Math.floor(Math.max(0, data.total - 1) / filter.limit) * filter.limit
          setFilter({ ...filter, offset })
          return
        }
        setInvitations(data.items)
        setTotal(data.total)
      } catch (e) {
        if (!cancelled) setLoadError(describeApiError(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [deviceId, type, filter, reloadTick])

  async function handleInvite(e) {
    e.preventDefault()
    if (!email.trim()) return
    setInviting(true)
    try {
      await createInvitation({ device_type: type, device_id: deviceId, email: email.trim() })
      setReloadTick((v) => v + 1)
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
      setReloadTick((v) => v + 1)
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
        <PageLoader gate={gate} compact onRetry={() => setReloadTick((v) => v + 1)} />
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
                  type="button"
                  aria-label={`Отозвать доступ для ${inv.email}`}
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

      {!gate.busy && (total > filter.limit || filter.offset > 0) && (
        <Pagination
          offset={filter.offset}
          limit={filter.limit}
          total={total}
          onChange={(patch) => setFilter((current) => ({ ...current, ...patch }))}
        />
      )}

      <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220 }}>
          <InputField
            label="Email пользователя"
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

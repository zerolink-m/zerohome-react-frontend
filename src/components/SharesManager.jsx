import { useEffect, useState } from 'react'
import { listShares, deleteShare } from '../api/shares'
import { describeApiError } from '../api/client'
import { useToast } from '../context/ToastContext'
import { formatUnixTs } from '../utils/format'
import { DEFAULT_LIMIT } from '../api/pagination'
import Button from './Button'
import Pill from './Pill'
import Pagination from './Pagination'
import ConfirmDialog from './ConfirmDialog'
import { colors } from '../styles/tokens'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from './PageLoader'

const TYPE_LABELS = {
  stream: 'стрим',
  record: 'запись',
  device_use: 'команда',
}

const TYPE_VARIANT = {
  stream: 'blue',
  record: 'green',
  device_use: 'yellow',
}

export default function SharesManager({ deviceId, deviceType, refreshKey = 0 }) {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState({ offset: 0, limit: DEFAULT_LIMIT })
  const [loading, setLoading] = useState(true)
  const gate = useLoadGate(loading)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removing, setRemoving] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // API не поддерживает фильтрацию по device_type/device_id, делаем на клиенте
        const data = await listShares(filter)
        if (cancelled) return
        const filtered = (data.items || []).filter(
          share => share.device_type === deviceType && share.device_id === deviceId
        )
        setItems(filtered)
        setTotal(filtered.length)
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
  }, [deviceId, deviceType, filter, refreshKey, reloadTick])

  async function handleRemove(shareId) {
    setRemoving(true)
    try {
      await deleteShare(shareId)
      toast.success('Ссылка отозвана')
      setReloadTick((v) => v + 1)
    } catch (e) {
      toast.error(describeApiError(e))
    } finally {
      setRemoving(false)
      setRemoveTarget(null)
    }
  }

  return (
    <div>
      {gate.busy ? (
        <PageLoader gate={gate} compact />
      ) : items.length === 0 ? (
        <div style={{ fontSize: 12, color: colors.white[3] }}>Нет активных ссылок</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((sh) => (
            <div
              key={sh.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: colors.white[4] }}>#{sh.id}</span>
                  <Pill variant={TYPE_VARIANT[sh.type] || 'default'}>
                    {TYPE_LABELS[sh.type] || sh.type}
                  </Pill>
                </div>
                {sh.filename && (
                  <div style={{ fontSize: 11, color: colors.white[3], wordBreak: 'break-all' }}>
                    {sh.filename}
                  </div>
                )}
                <div style={{ fontSize: 11, color: colors.white[2] }}>
                  Создана: {formatUnixTs(sh.added_at)} · Обновлена: {formatUnixTs(sh.updated_at)}
                </div>
              </div>
              <Button small onClick={() => setRemoveTarget(sh)} disabled={removing}>
                Отозвать
              </Button>
            </div>
          ))}
        </div>
      )}

      {total > filter.limit && (
        <Pagination
          offset={filter.offset}
          limit={filter.limit}
          total={total}
          onChange={(next) => setFilter((f) => ({ ...f, ...next }))}
        />
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="Отозвать ссылку?"
        message="Ссылка перестанет работать немедленно."
        confirmLabel="Отозвать"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => handleRemove(removeTarget.id)}
        loading={removing}
      />
    </div>
  )
}

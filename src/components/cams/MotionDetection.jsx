import { useEffect, useState } from 'react'
import { getMotionStatus, startMotionDetection, stopMotionDetection, patchPushSettings } from '../../api/cams'
import { CODES } from '../../api/codes'
import PushSettings from './PushSettings'
import { useToast } from '../../context/ToastContext'
import Toggle from '../Toggle'
import { colors } from '../../styles/tokens'
import { useLoadGate } from '../../hooks/useLoadGate'
import PageLoader from '../PageLoader'

export default function MotionDetection({ camId }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)
  const gate = useLoadGate(loading, loadError)
  const [actionLoading, setActionLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getMotionStatus(camId)
      .then((data) => { if (!cancelled) setStatus(data) })
      .catch((error) => { if (!cancelled) setLoadError(error.message || 'Ошибка загрузки статуса детекции') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [camId, reloadTick])

  async function handleToggle(enabled) {
    try {
      setActionLoading(true)
      // Разрешение на запуск проверяет сервер по владельцу камеры.
      const nextStatus = enabled ? await startMotionDetection(camId) : await stopMotionDetection(camId)
      setStatus(nextStatus)
      if (Boolean(nextStatus.is_active) !== enabled) {
        toast.warning(enabled ? 'Сервер не подтвердил запуск детекции.' : 'Сервер не подтвердил остановку детекции.')
        return
      }
      if (enabled) {
        try {
          await patchPushSettings(camId, { motion_detection_enabled: 1 })
        } catch {
          toast.warning('Детекция запущена, но уведомления не удалось включить. Их можно настроить отдельно.')
          return
        }
      }
      toast.success(enabled ? 'Детекция движения запущена' : 'Детекция движения остановлена')
    } catch (err) {
      toast.error(enabled && err.code === CODES.FORBIDDEN_RESOURCE
        ? 'Запуск детекции недоступен. Проверьте разрешение владельца камеры.'
        : err.message || 'Ошибка изменения статуса детекции')
    } finally {
      setActionLoading(false)
    }
  }

  if (gate.busy) {
    return <PageLoader gate={gate} compact onRetry={() => setReloadTick((tick) => tick + 1)} />
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <Toggle
          label="Детекция движения"
          checked={Boolean(status?.is_active)}
          onChange={handleToggle}
          disabled={actionLoading}
        />
      </div>
      {status?.is_active && !actionLoading && (
        <>
          <div style={{ fontSize: 12, color: colors.white[3], marginTop: 8 }}>
            Система активно отслеживает движение в кадре
          </div>
          <div style={{ marginTop: 16 }}>
            <PushSettings camId={camId} section="motion" />
          </div>
        </>
      )}
    </div>
  )
}

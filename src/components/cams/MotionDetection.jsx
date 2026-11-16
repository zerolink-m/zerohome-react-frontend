import { useState, useEffect } from 'react'
import { getMotionStatus, startMotionDetection, stopMotionDetection, patchPushSettings } from '../../api/cams'
import PushSettings from './PushSettings'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import Toggle from '../Toggle'
import { colors } from '../../styles/tokens'
import { useLoadGate } from '../../hooks/useLoadGate'
import PageLoader from '../PageLoader'

export default function MotionDetection({ camId }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const gate = useLoadGate(loading)
  const [actionLoading, setActionLoading] = useState(false)
  const [pushKey, setPushKey] = useState(0) // перемонтирует настройки push после скрытого включения
  const toast = useToast()
  const { profile, refreshProfile } = useAuth()

  useEffect(() => {
    // Обновляем профиль при монтировании компонента
    refreshProfile()
    loadStatus()
  }, [camId, refreshProfile])

  async function loadStatus() {
    try {
      setLoading(true)
      const data = await getMotionStatus(camId)
      setStatus(data)
    } catch (err) {
      toast.error(err.message || 'Ошибка загрузки статуса детекции')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(enabled) {
    try {
      setActionLoading(true)
      if (enabled) {
        // Порядок: сначала (скрыто) push по движению, потом сама детекция, потом открываются настройки push.
        await patchPushSettings(camId, { motion_detection_enabled: 1 })
        await startMotionDetection(camId)
        setPushKey((k) => k + 1)
      } else {
        await stopMotionDetection(camId)
      }
      // Перезагружаем статус с сервера после изменения
      await loadStatus()
      toast.success(enabled ? 'Детекция движения запущена' : 'Детекция движения остановлена')
    } catch (err) {
      toast.error(err.message || 'Ошибка изменения статуса детекции')
    } finally {
      setActionLoading(false)
    }
  }

  if (gate.busy) {
    return <PageLoader gate={gate} compact />
  }

  // Проверка разрешения на использование детекции движения
  const isAllowed = profile?.motion_detection_allowed === 1

  if (!isAllowed) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: colors.white[4], lineHeight: 1.6 }}>
        <p style={{ marginBottom: 8 }}>⚠️ Детекция движения недоступна для вашего аккаунта.</p>
        <p>Обратитесь к администратору для активации этой функции.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: colors.white[4], display: 'block', marginBottom: 8 }}>
          Детекция движения
        </label>
        <Toggle
          checked={status?.is_active || false}
          onChange={handleToggle}
          disabled={actionLoading}
        />
      </div>
      {status?.is_active && (
        <>
          <div style={{ fontSize: 12, color: colors.white[3], marginTop: 8 }}>
            Система активно отслеживает движение в кадре
          </div>
          <div style={{ marginTop: 16 }}>
            <PushSettings key={pushKey} camId={camId} section="motion" />
          </div>
        </>
      )}
    </div>
  )
}

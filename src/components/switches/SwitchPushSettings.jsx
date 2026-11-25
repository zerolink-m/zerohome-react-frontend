import { useState, useEffect } from 'react'
import { getSwitchPushSettings, patchSwitchPushSettings } from '../../api/switches'
import { useToast } from '../../context/ToastContext'
import Toggle from '../Toggle'
import Button from '../Button'
import { colors } from '../../styles/tokens'
import { useLoadGate } from '../../hooks/useLoadGate'
import PageLoader from '../PageLoader'

export default function SwitchPushSettings({ switchId }) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const gate = useLoadGate(loading)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    loadSettings()
  }, [switchId])

  async function loadSettings() {
    try {
      setLoading(true)
      const data = await getSwitchPushSettings(switchId)
      setSettings(data)
    } catch (err) {
      toast.error(err.message || 'Ошибка загрузки настроек')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      const data = await patchSwitchPushSettings(switchId, settings)
      setSettings(data)
      toast.success('Настройки сохранены')
    } catch (err) {
      toast.error(err.message || 'Ошибка сохранения настроек')
    } finally {
      setSaving(false)
    }
  }

  function updateSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (gate.busy) {
    return <PageLoader gate={gate} compact />
  }

  if (!settings) {
    return <div style={{ fontSize: 13, color: colors.white[4], padding: 16 }}>Не удалось загрузить настройки</div>
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 20 }}>
      <div>
        <label style={{ fontSize: 13, color: colors.white[4], display: 'block', marginBottom: 8 }}>
          Включить уведомления
        </label>
        <Toggle
          aria-label="Уведомления выключателя"
          checked={Boolean(settings.enabled)}
          onChange={(checked) => updateSetting('enabled', checked ? 1 : 0)}
        />
      </div>

      <div>
        <h4 style={{ fontSize: 14, marginBottom: 12, color: colors.white[5] }}>Уведомления о состоянии</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          <div>
            <label style={{ fontSize: 12, color: colors.white[4], display: 'block', marginBottom: 4 }}>
              Устройство в сети
            </label>
            <Toggle
              aria-label="Устройство в сети"
              checked={Boolean(settings.notify_online)}
              onChange={(checked) => updateSetting('notify_online', checked ? 1 : 0)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: colors.white[4], display: 'block', marginBottom: 4 }}>
              Устройство не отвечает
            </label>
            <Toggle
              aria-label="Устройство не отвечает"
              checked={Boolean(settings.notify_offline)}
              onChange={(checked) => updateSetting('notify_offline', checked ? 1 : 0)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: colors.white[4], display: 'block', marginBottom: 4 }}>
              Изменение состояния
            </label>
            <Toggle
              aria-label="Изменение состояния выключателя"
              checked={Boolean(settings.notify_state_change)}
              onChange={(checked) => updateSetting('notify_state_change', checked ? 1 : 0)}
            />
          </div>
        </div>
      </div>

      <div>
        <Button variant="accent" onClick={handleSave} loading={saving}>
          Сохранить
        </Button>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { patchOnvifSettings } from '../../api/cams'
import { useToast } from '../../context/ToastContext'
import Toggle from '../Toggle'
import Button from '../Button'

export default function OnvifSettings({ camId, initialSettings }) {
  const [settings, setSettings] = useState({
    onvif_enabled: initialSettings?.onvif_enabled ?? 0,
    onvif_snapshot_enabled: initialSettings?.onvif_snapshot_enabled ?? 0,
    onvif_ptz_enabled: initialSettings?.onvif_ptz_enabled ?? 0
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (initialSettings) {
      setSettings({
        onvif_enabled: initialSettings.onvif_enabled ?? 0,
        onvif_snapshot_enabled: initialSettings.onvif_snapshot_enabled ?? 0,
        onvif_ptz_enabled: initialSettings.onvif_ptz_enabled ?? 0
      })
    }
  }, [initialSettings])

  async function handleSave() {
    try {
      setSaving(true)
      const data = await patchOnvifSettings(camId, settings)
      setSettings(data)
      toast.success('Настройки ONVIF сохранены')
    } catch (err) {
      toast.error(err.message || 'Ошибка сохранения настроек')
    } finally {
      setSaving(false)
    }
  }

  function updateSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="onvif-settings">
      <h3>Настройки ONVIF</h3>

      <div className="setting-group">
        <Toggle
          label="Включить ONVIF"
          checked={Boolean(settings.onvif_enabled)}
          onChange={(checked) => updateSetting('onvif_enabled', checked ? 1 : 0)}
        />

        <Toggle
          label="Включить ONVIF снимки"
          checked={Boolean(settings.onvif_snapshot_enabled)}
          onChange={(checked) => updateSetting('onvif_snapshot_enabled', checked ? 1 : 0)}
          disabled={!settings.onvif_enabled}
        />

        <Toggle
          label="Включить ONVIF PTZ"
          checked={Boolean(settings.onvif_ptz_enabled)}
          onChange={(checked) => updateSetting('onvif_ptz_enabled', checked ? 1 : 0)}
          disabled={!settings.onvif_enabled}
        />
      </div>

      <div className="onvif-settings-actions">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>
    </div>
  )
}

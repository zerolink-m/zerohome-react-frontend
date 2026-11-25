import { useState, useEffect } from 'react'
import { patchOnvifSettings } from '../../api/cams'
import { useToast } from '../../context/ToastContext'
import Toggle from '../Toggle'
import Button from '../Button'

function extractFlags(data) {
  return {
    onvif_enabled: data?.onvif_enabled ?? 0,
    onvif_snapshot_enabled: data?.onvif_snapshot_enabled ?? 0,
    onvif_ptz_enabled: data?.onvif_ptz_enabled ?? 0,
  }
}

export default function OnvifSettings({ camId, initialSettings, onSaved }) {
  const { onvif_enabled, onvif_snapshot_enabled, onvif_ptz_enabled } = extractFlags(initialSettings)
  const [settings, setSettings] = useState(() => extractFlags(initialSettings))
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    setSettings({ onvif_enabled, onvif_snapshot_enabled, onvif_ptz_enabled })
  }, [onvif_enabled, onvif_snapshot_enabled, onvif_ptz_enabled])

  async function handleSave() {
    try {
      setSaving(true)
      const data = await patchOnvifSettings(camId, settings)
      const nextSettings = extractFlags(data)
      setSettings(nextSettings)
      onSaved?.(nextSettings)
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
          disabled={saving}
          checked={Boolean(settings.onvif_enabled)}
          onChange={(checked) => updateSetting('onvif_enabled', checked ? 1 : 0)}
        />

        <Toggle
          label="Включить ONVIF снимки"
          checked={Boolean(settings.onvif_snapshot_enabled)}
          onChange={(checked) => updateSetting('onvif_snapshot_enabled', checked ? 1 : 0)}
          disabled={saving || !settings.onvif_enabled}
        />

        <Toggle
          label="Включить ONVIF PTZ"
          checked={Boolean(settings.onvif_ptz_enabled)}
          onChange={(checked) => updateSetting('onvif_ptz_enabled', checked ? 1 : 0)}
          disabled={saving || !settings.onvif_enabled}
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

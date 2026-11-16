import { useState, useEffect, useRef } from 'react'
import { getPushSettings, patchPushSettings } from '../../api/cams'
import { useToast } from '../../context/ToastContext'
import Toggle from '../Toggle'
import InputField from '../InputField'
import Button from '../Button'
import { colors } from '../../styles/tokens'
import { useLoadGate } from '../../hooks/useLoadGate'
import PageLoader from '../PageLoader'

const GENERAL_KEYS = ['enabled', 'notify_online', 'notify_offline', 'notify_state_change']
const MOTION_KEYS = [
  'motion_detection_enabled', 'motion_min_confidence', 'motion_min_object_size', 'motion_cooldown_seconds',
  'motion_detect_person', 'motion_detect_dog', 'motion_detect_cat', 'motion_detect_car', 'motion_license_plate_ocr',
]
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]))

// section: 'general' — общие уведомления и состояние камеры (вкладка «Настройки уведомлений»),
//          'motion'  — push по детекции движения (вкладка «Детекция движения»).
// Каждая секция отправляет только свои поля, чтобы не затирать настройки другой.
//
// onSyncNotify(value) — для 'general': вызывается, если пользователь изменил «Включить уведомления».
// Общий выключатель совмещён со старым флагом камеры `notify`: родитель выставляет его в то же значение.
export default function PushSettings({ camId, section = 'general', onSyncNotify }) {
  const savedEnabled = useRef(null) // значение enabled на сервере (после загрузки/сохранения)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const gate = useLoadGate(loading)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    loadSettings()
  }, [camId])

  async function loadSettings() {
    try {
      setLoading(true)
      const data = await getPushSettings(camId)
      setSettings(data)
      savedEnabled.current = data.enabled
    } catch (err) {
      toast.error(err.message || 'Ошибка загрузки настроек')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      const data = await patchPushSettings(camId, pick(settings, section === 'motion' ? MOTION_KEYS : GENERAL_KEYS))
      setSettings(data)
      // Старый флаг notify трогаем только если переключатель изменили: иначе первое же сохранение
      // дало бы побочный push (включение notify 0→1 отправляет уведомление).
      if (section === 'general' && onSyncNotify && Boolean(data.enabled) !== Boolean(savedEnabled.current)) {
        await onSyncNotify(data.enabled ? 1 : 0)
      }
      savedEnabled.current = data.enabled
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
      {section === 'general' && (
        <>
      <div>
        <label style={{ fontSize: 13, color: colors.white[4], display: 'block', marginBottom: 8 }}>
          Включить уведомления
        </label>
        <Toggle
          checked={Boolean(settings.enabled)}
          onChange={(checked) => updateSetting('enabled', checked ? 1 : 0)}
        />
      </div>

      <div>
        <h4 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text)' }}>Уведомления о состоянии</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          <div>
            <label style={{ fontSize: 12, color: colors.white[4], display: 'block', marginBottom: 4 }}>
              Камера в сети
            </label>
            <Toggle
              checked={Boolean(settings.notify_online)}
              onChange={(checked) => updateSetting('notify_online', checked ? 1 : 0)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: colors.white[4], display: 'block', marginBottom: 4 }}>
              Камера не отвечает
            </label>
            <Toggle
              checked={Boolean(settings.notify_offline)}
              onChange={(checked) => updateSetting('notify_offline', checked ? 1 : 0)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: colors.white[4], display: 'block', marginBottom: 4 }}>
              Изменение состояния
            </label>
            <Toggle
              checked={Boolean(settings.notify_state_change)}
              onChange={(checked) => updateSetting('notify_state_change', checked ? 1 : 0)}
            />
          </div>
        </div>
      </div>

        </>
      )}

      {section === 'motion' && (
        <>
      <div>
        <h4 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text)' }}>Уведомления о движении</h4>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: colors.white[4], display: 'block', marginBottom: 8 }}>
            Присылать push о движении
          </label>
          <Toggle
            checked={Boolean(settings.motion_detection_enabled)}
            onChange={(checked) => updateSetting('motion_detection_enabled', checked ? 1 : 0)}
          />
        </div>

        {settings.motion_detection_enabled === 1 && (
          <div style={{ display: 'grid', gap: 12, marginTop: 12, paddingLeft: 12, borderLeft: `2px solid ${colors.white[1]}` }}>
            <InputField
              label="Минимальная уверенность (0.0-1.0)"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={settings.motion_min_confidence}
              onChange={(e) => updateSetting('motion_min_confidence', parseFloat(e.target.value))}
            />

            <InputField
              label="Минимальный размер объекта (0.0-1.0)"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={settings.motion_min_object_size}
              onChange={(e) => updateSetting('motion_min_object_size', parseFloat(e.target.value))}
            />

            <InputField
              label="Задержка между уведомлениями (сек)"
              type="number"
              min="0"
              value={settings.motion_cooldown_seconds}
              onChange={(e) => updateSetting('motion_cooldown_seconds', parseInt(e.target.value))}
            />

            <div>
              <h5 style={{ fontSize: 13, marginBottom: 8, color: colors.white[4] }}>Типы объектов для детекции</h5>
              <div style={{ display: 'grid', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 12, color: colors.white[4], display: 'block', marginBottom: 4 }}>
                    Люди
                  </label>
                  <Toggle
                    checked={Boolean(settings.motion_detect_person)}
                    onChange={(checked) => updateSetting('motion_detect_person', checked ? 1 : 0)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: colors.white[4], display: 'block', marginBottom: 4 }}>
                    Собаки
                  </label>
                  <Toggle
                    checked={Boolean(settings.motion_detect_dog)}
                    onChange={(checked) => updateSetting('motion_detect_dog', checked ? 1 : 0)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: colors.white[4], display: 'block', marginBottom: 4 }}>
                    Кошки
                  </label>
                  <Toggle
                    checked={Boolean(settings.motion_detect_cat)}
                    onChange={(checked) => updateSetting('motion_detect_cat', checked ? 1 : 0)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: colors.white[4], display: 'block', marginBottom: 4 }}>
                    Машины
                  </label>
                  <Toggle
                    checked={Boolean(settings.motion_detect_car)}
                    onChange={(checked) => updateSetting('motion_detect_car', checked ? 1 : 0)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: colors.white[4], display: 'block', marginBottom: 4 }}>
                    Распознавание номеров (OCR)
                  </label>
                  <Toggle
                    checked={Boolean(settings.motion_license_plate_ocr)}
                    onChange={(checked) => updateSetting('motion_license_plate_ocr', checked ? 1 : 0)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

        </>
      )}

      <div>
        <Button variant="accent" onClick={handleSave} loading={saving}>
          Сохранить
        </Button>
      </div>
    </div>
  )
}

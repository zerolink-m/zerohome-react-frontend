import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSystemSetting, listSystemSettings, patchSystemSetting } from '../api/systemSettings'
import Button from '../components/Button'
import DashCard from '../components/DashCard'
import PageLoader from '../components/PageLoader'
import Pill from '../components/Pill'
import { useToast } from '../context/ToastContext'
import { useLoadGate } from '../hooks/useLoadGate'
import { colors } from '../styles/tokens'

const SECRET_NAME = /secret|token|password|credential|private.?key/i
const MASKED_VALUE = /^(?:\*{3,}|•{3,}|<\s*(?:redacted|hidden|masked)\s*>|redacted|hidden|masked)$/i

function isSecret(setting) {
  return setting?.is_secret === true || setting?.secret === true || SECRET_NAME.test(String(setting?.key || ''))
    || (typeof setting?.value === 'string' && MASKED_VALUE.test(setting.value.trim()))
}

function valuePreview(setting) {
  if (isSecret(setting)) return 'Скрыто'
  if (setting?.value == null) return 'null'
  const text = typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value)
  return text.length > 120 ? `${text.slice(0, 117)}…` : text
}

function printable(value) {
  return JSON.stringify(value ?? null, null, 2)
}

export default function AdminSystemSettingsPage() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [revision, setRevision] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [active, setActive] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [valueText, setValueText] = useState('')
  const [secretValue, setSecretValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [restartRequired, setRestartRequired] = useState(false)
  const gate = useLoadGate(loading, loadError)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await listSystemSettings({ limit: 255, offset: 0, sort_by: 'key', order: 'asc' })
      setItems(result.items)
      setRevision(result.revision)
    } catch (error) {
      setLoadError(error.message || 'Не удалось загрузить настройки')
      toast.error(error.message || 'Не удалось загрузить настройки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function selectSetting(setting) {
    setActive({ ...setting, value: setting.value })
    setValueText(printable(setting.value))
    setSecretValue('')
    setDetailLoading(true)
    try {
      const result = await getSystemSetting(setting.key)
      const next = result.setting || setting
      setActive(next)
      setRevision(result.revision ?? revision)
      if (!isSecret(next)) setValueText(printable(next.value))
    } catch (error) {
      toast.error(error.message || 'Не удалось загрузить настройку')
    } finally {
      setDetailLoading(false)
    }
  }

  async function save() {
    if (!active) return
    const secret = isSecret(active)
    let nextValue
    if (secret) {
      if (!secretValue) {
        toast.info('Введите новое значение секрета или отмените изменение')
        return
      }
      nextValue = secretValue
    } else {
      try {
        nextValue = JSON.parse(valueText)
      } catch {
        toast.error('Проверьте JSON: текстовые значения должны быть в кавычках')
        return
      }
    }

    setSaving(true)
    try {
      const result = await patchSystemSetting(active.key, nextValue)
      setRevision(result.revision ?? revision)
      setRestartRequired(result.restartRequired)
      toast.success('Настройка сохранена')
      setActive(result.setting || { ...active, value: secret ? 'Скрыто' : nextValue })
      setSecretValue('')
      await load()
    } catch (error) {
      toast.error(error.message || 'Не удалось сохранить настройку')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <Link to="/admin" style={{ color: colors.white[4], fontSize: 12, textDecoration: 'none' }}>← Админ-панель</Link>
          <h1 style={{ fontSize: 20, margin: '10px 0 0' }}>Настройки системы</h1>
        </div>
        <Button onClick={load} loading={loading}>Обновить</Button>
      </div>

      {restartRequired && (
        <div role="status" style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: colors.statuses.yellow.bg, border: `1px solid ${colors.statuses.yellow.border}`, color: colors.statuses.yellow.text, fontSize: 13 }}>
          Настройки сохранены. Для применения требуется перезапуск сервера.
        </div>
      )}

      {gate.busy ? <PageLoader gate={gate} onRetry={load} /> : items.length === 0 ? (
        <DashCard><div style={{ color: colors.white[4], fontSize: 13 }}>Разрешённые настройки системы не найдены.</div></DashCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, alignItems: 'start' }}>
          <DashCard style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, margin: 0 }}>Параметры</h2>
              {revision != null && <Pill>ревизия {revision}</Pill>}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {items.map((setting) => (
                <button
                  key={setting.key}
                  type="button"
                  onClick={() => selectSetting(setting)}
                  aria-current={active?.key === setting.key ? 'true' : undefined}
                  style={{ textAlign: 'left', cursor: 'pointer', padding: 12, color: colors.text, background: active?.key === setting.key ? 'var(--accent-bg)' : 'var(--card-bg)', border: `1px solid ${active?.key === setting.key ? 'var(--accent-border)' : colors.white[8]}`, borderRadius: 12, minWidth: 0 }}
                >
                  <span style={{ display: 'block', font: '12px var(--font-mono, monospace)', overflowWrap: 'anywhere' }}>{setting.key}</span>
                  <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: colors.white[4], overflowWrap: 'anywhere' }}>{valuePreview(setting)}</span>
                </button>
              ))}
            </div>
          </DashCard>

          <DashCard style={{ padding: 18 }}>
            {!active ? (
              <div style={{ color: colors.white[4], fontSize: 13 }}>Выберите параметр, чтобы просмотреть или изменить его.</div>
            ) : detailLoading ? (
              <div role="status" style={{ color: colors.white[4], fontSize: 13 }}>Загружаем настройку…</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 15, margin: 0, overflowWrap: 'anywhere' }}>{active.key}</h2>
                  {isSecret(active) && <Pill variant="yellow">секрет</Pill>}
                </div>
                {isSecret(active) ? (
                  <div style={{ marginTop: 18 }}>
                    <label htmlFor="system-secret-value" style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 8 }}>Новое значение секрета</label>
                    <input id="system-secret-value" type="password" autoComplete="new-password" value={secretValue} onChange={(event) => setSecretValue(event.target.value)} placeholder="Текущее значение скрыто" style={{ width: '100%', minHeight: 44, padding: '10px 12px', background: 'var(--card-bg)', border: `1px solid ${colors.white[8]}`, borderRadius: 12, color: colors.text }} />
                    <p style={{ fontSize: 12, lineHeight: 1.5, color: colors.white[4], margin: '8px 0 0' }}>Существующее значение не раскрывается. Пустое поле ничего не меняет.</p>
                  </div>
                ) : (
                  <div style={{ marginTop: 18 }}>
                    <label htmlFor="system-setting-value" style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 8 }}>Значение (JSON)</label>
                    <textarea id="system-setting-value" value={valueText} onChange={(event) => setValueText(event.target.value)} rows={10} spellCheck="false" style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', padding: 12, background: 'var(--card-bg)', border: `1px solid ${colors.white[8]}`, borderRadius: 12, color: colors.text, font: '12px/1.6 var(--font-mono, monospace)' }} />
                    <p style={{ fontSize: 12, lineHeight: 1.5, color: colors.white[4], margin: '8px 0 0' }}>Строки вводятся в кавычках; числа, `true`, `false` и `null` — без кавычек.</p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                  <Button variant="accent" onClick={save} loading={saving}>Сохранить</Button>
                  <Button onClick={() => { setActive(null); setSecretValue('') }} disabled={saving}>Закрыть</Button>
                </div>
              </>
            )}
          </DashCard>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listSystemSettings, patchSystemSetting } from '../api/systemSettings'
import Button from '../components/Button'
import DashCard from '../components/DashCard'
import InputField from '../components/InputField'
import PageLoader from '../components/PageLoader'
import Pill from '../components/Pill'
import Toggle from '../components/Toggle'
import { useToast } from '../context/ToastContext'
import { useLoadGate } from '../hooks/useLoadGate'
import { colors } from '../styles/tokens'

const SECRET_NAME = /secret|token|password|credential|private.?key/i
const MASKED_VALUE = /^(?:\*{3,}|•{3,}|<\s*(?:redacted|hidden|masked)\s*>|redacted|hidden|masked)$/i

function isSecret(setting) {
  return setting?.is_secret === true || setting?.secret === true || SECRET_NAME.test(String(setting?.key || ''))
    || (typeof setting?.value === 'string' && MASKED_VALUE.test(setting.value.trim()))
}

function valueLabel(value) {
  if (value === null) return 'null'
  if (typeof value === 'string') return value || 'Пустая строка'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function isJsonValue(value) {
  return value === null || typeof value === 'object'
}

function SettingCard({ setting, saving, onSave }) {
  const secret = isSecret(setting)
  const [draft, setDraft] = useState(secret ? '' : setting.value)
  const [jsonText, setJsonText] = useState(() => JSON.stringify(setting.value, null, 2))
  const [error, setError] = useState(null)
  const jsonValue = isJsonValue(setting.value)

  useEffect(() => {
    setDraft(isSecret(setting) ? '' : setting.value)
    setJsonText(JSON.stringify(setting.value, null, 2))
    setError(null)
  }, [setting.value])

  function currentDraft() {
    if (secret) return draft
    if (typeof setting.value === 'boolean') return Boolean(draft)
    if (typeof setting.value === 'number') {
      if (draft === '') throw new Error('Введите число')
      return Number(draft)
    }
    if (typeof setting.value === 'string') return String(draft ?? '')
    try { return JSON.parse(jsonText) } catch { throw new Error('Проверьте JSON-синтаксис') }
  }

  async function save() {
    setError(null)
    let value
    try {
      value = currentDraft()
      if (typeof setting.value === 'number' && !Number.isFinite(value)) throw new Error('Введите корректное число')
      if (secret && !String(value || '').trim()) return
    } catch (saveError) {
      setError(saveError.message)
      return
    }
    await onSave(setting.key, value)
  }

  const dirty = secret
    ? typeof draft === 'string' && draft.trim().length > 0
    : jsonValue
      ? jsonText !== JSON.stringify(setting.value, null, 2)
      : !Object.is(draft, setting.value)

  return (
    <DashCard style={{ padding: 18, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 14, margin: 0, overflowWrap: 'anywhere' }}>{setting.key}</h2>
          <div style={{ fontSize: 11, color: colors.white[3], marginTop: 5 }}>Тип: {secret ? 'секрет' : setting.value === null ? 'null' : typeof setting.value}</div>
        </div>
        {secret && <Pill variant="yellow">скрыто</Pill>}
      </div>

      <div style={{ padding: '10px 12px', marginBottom: 14, borderRadius: 10, border: `1px solid ${colors.white[8]}`, background: 'var(--card-bg)', minWidth: 0 }}>
        <div style={{ fontSize: 10, color: colors.white[3], textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Текущее значение</div>
        <div style={{ fontSize: 12, color: colors.white[6], overflowWrap: 'anywhere', whiteSpace: jsonValue ? 'pre-wrap' : undefined }}>{secret ? 'Секрет не раскрывается сервером' : valueLabel(setting.value)}</div>
      </div>

      {secret ? (
        <div>
          <InputField label="Новое значение" type="password" autoComplete="new-password" value={typeof draft === 'string' ? draft : ''} onChange={(event) => setDraft(event.target.value)} placeholder="Оставьте пустым, чтобы не менять" />
        </div>
      ) : typeof setting.value === 'boolean' ? (
        <div style={{ marginBottom: 18 }}>
          <span style={{ display: 'block', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.12em', color: colors.white[3], marginBottom: 8 }}>Новое значение</span>
          <Toggle checked={Boolean(draft)} onChange={setDraft} label={setting.key} disabled={saving} />
        </div>
      ) : typeof setting.value === 'number' ? (
        <InputField label="Новое значение" type="number" step="any" value={draft ?? ''} onChange={(event) => setDraft(event.target.value === '' ? '' : Number(event.target.value))} />
      ) : typeof setting.value === 'string' ? (
        <InputField label="Новое значение" value={draft ?? ''} onChange={(event) => setDraft(event.target.value)} />
      ) : (
        <div style={{ marginBottom: 18 }}>
          <label htmlFor={`setting-${setting.key}`} style={{ display: 'block', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.12em', color: colors.white[3], marginBottom: 8 }}>Новое значение (JSON)</label>
          <textarea id={`setting-${setting.key}`} value={jsonText} onChange={(event) => setJsonText(event.target.value)} rows={5} spellCheck="false" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 12, background: 'var(--card-bg)', border: `1px solid ${colors.white[8]}`, borderRadius: 12, color: colors.text, font: '12px/1.6 var(--font-mono, monospace)' }} />
        </div>
      )}

      {error && <div role="alert" style={{ color: colors.statuses.red.text, fontSize: 12, margin: '-6px 0 12px' }}>{error}</div>}
      <Button variant="accent" onClick={save} loading={saving} disabled={!dirty || (secret && !String(draft || '').trim())}>Сохранить настройку</Button>
    </DashCard>
  )
}

export default function AdminSystemSettingsPage() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [revision, setRevision] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [savingKeys, setSavingKeys] = useState({})
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

  async function saveSetting(key, value) {
    setSavingKeys((current) => ({ ...current, [key]: true }))
    try {
      const result = await patchSystemSetting(key, value)
      setRevision(result.revision ?? revision)
      setRestartRequired((current) => current || result.restartRequired)
      setItems((current) => current.map((item) => item.key === key ? (result.setting || { ...item, value }) : item))
      toast.success(`Настройка «${key}» сохранена`)
    } catch (error) {
      toast.error(error.message || `Не удалось сохранить «${key}»`)
    } finally {
      setSavingKeys((current) => ({ ...current, [key]: false }))
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
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            {revision != null && <Pill>ревизия {revision}</Pill>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, alignItems: 'start' }}>
            {items.map((setting) => <SettingCard key={setting.key} setting={setting} saving={Boolean(savingKeys[setting.key])} onSave={saveSetting} />)}
          </div>
        </>
      )}
    </div>
  )
}

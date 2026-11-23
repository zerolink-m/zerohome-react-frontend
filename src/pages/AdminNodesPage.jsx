import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNode, listNodes, patchNode } from '../api/nodes'
import Button from '../components/Button'
import DashCard from '../components/DashCard'
import PageLoader from '../components/PageLoader'
import Pill from '../components/Pill'
import { useToast } from '../context/ToastContext'
import { useLoadGate } from '../hooks/useLoadGate'
import { colors } from '../styles/tokens'

const MASKED_VALUE = /^(?:\*{3,}|•{3,}|<\s*(?:redacted|hidden|masked)\s*>|redacted|hidden|masked)$/i
const SECRET_NAME = /secret|token|password|credential|private.?key/i

function pretty(value) {
  return JSON.stringify(value ?? {}, null, 2)
}

function timestamp(value) {
  if (value == null) return '—'
  const seconds = Number(value)
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toLocaleString() : String(value)
}

function hasMaskedSecret(value) {
  if (Array.isArray(value)) return value.some(hasMaskedSecret)
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, child]) => {
    if (SECRET_NAME.test(key) && (child == null || (typeof child === 'string' && MASKED_VALUE.test(child.trim())))) return true
    return hasMaskedSecret(child)
  })
}

function parseObject(text, label) {
  let parsed
  try { parsed = JSON.parse(text) } catch { throw new Error(`${label}: проверьте JSON-синтаксис`) }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label}: ожидается JSON-объект`)
  return parsed
}

function JsonEditor({ id, label, value, onChange, disabled, helper }) {
  return (
    <div style={{ marginTop: 18 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 8 }}>{label}</label>
      <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} rows={11} spellCheck="false" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 12, background: 'var(--card-bg)', border: `1px solid ${colors.white[8]}`, borderRadius: 12, color: colors.text, opacity: disabled ? 0.58 : 1, font: '12px/1.6 var(--font-mono, monospace)' }} />
      {helper && <p style={{ fontSize: 12, lineHeight: 1.5, color: disabled ? colors.statuses.yellow.text : colors.white[4], margin: '8px 0 0' }}>{helper}</p>}
    </div>
  )
}

export default function AdminNodesPage() {
  const toast = useToast()
  const [nodes, setNodes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [node, setNode] = useState(null)
  const [settingsText, setSettingsText] = useState('{}')
  const [capabilitiesText, setCapabilitiesText] = useState('{}')
  const [savedSettingsText, setSavedSettingsText] = useState('{}')
  const [savedCapabilitiesText, setSavedCapabilitiesText] = useState('{}')
  const [revision, setRevision] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [restartRequired, setRestartRequired] = useState(false)
  const gate = useLoadGate(loading, loadError)
  const settingsMasked = hasMaskedSecret(node?.settings)

  async function loadNodes() {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await listNodes({ limit: 255, offset: 0 })
      setNodes(result.items)
      if (selectedId == null && result.items.length) setSelectedId(result.items[0].node_id)
    } catch (error) {
      setLoadError(error.message || 'Не удалось загрузить список нод')
      toast.error(error.message || 'Не удалось загрузить список нод')
    } finally {
      setLoading(false)
    }
  }

  async function loadNode(nodeId) {
    if (nodeId == null) return
    setDetailLoading(true)
    try {
      const result = await getNode(nodeId)
      const current = result.node
      setNode(current)
      const nextSettings = pretty(current?.settings)
      const nextCapabilities = pretty(current?.capabilities)
      setSettingsText(nextSettings)
      setSavedSettingsText(nextSettings)
      setCapabilitiesText(nextCapabilities)
      setSavedCapabilitiesText(nextCapabilities)
      setRevision(result.revision)
    } catch (error) {
      toast.error(error.message || 'Не удалось загрузить конфигурацию ноды')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => { loadNodes() }, [])
  useEffect(() => { if (selectedId != null) loadNode(selectedId) }, [selectedId])

  async function save() {
    if (!node) return
    const patch = {}
    try {
      if (!settingsMasked && settingsText !== savedSettingsText) patch.settings = parseObject(settingsText, 'Настройки')
      if (capabilitiesText !== savedCapabilitiesText) patch.capabilities = parseObject(capabilitiesText, 'Возможности')
      if (!Object.keys(patch).length) {
        toast.info('Изменений для сохранения нет')
        return
      }
    } catch (error) {
      toast.error(error.message)
      return
    }

    setSaving(true)
    try {
      const result = await patchNode(node.node_id, patch)
      setRevision(result.revision ?? revision)
      setRestartRequired(result.restartRequired)
      toast.success('Конфигурация ноды сохранена')
      await loadNode(node.node_id)
      await loadNodes()
    } catch (error) {
      toast.error(error.message || 'Не удалось сохранить конфигурацию ноды')
    } finally {
      setSaving(false)
    }
  }

  const dirty = (!settingsMasked && settingsText !== savedSettingsText) || capabilitiesText !== savedCapabilitiesText

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <Link to="/admin" style={{ color: colors.white[4], fontSize: 12, textDecoration: 'none' }}>← Админ-панель</Link>
          <h1 style={{ fontSize: 20, margin: '10px 0 0' }}>Ноды</h1>
        </div>
        <Button onClick={loadNodes} loading={loading}>Обновить список</Button>
      </div>

      {restartRequired && <div role="status" style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: colors.statuses.yellow.bg, border: `1px solid ${colors.statuses.yellow.border}`, color: colors.statuses.yellow.text, fontSize: 13 }}>Изменения сохранены. Для их применения требуется перезапуск.</div>}

      {gate.busy ? <PageLoader gate={gate} onRetry={loadNodes} /> : nodes.length === 0 ? (
        <DashCard><div style={{ color: colors.white[4], fontSize: 13 }}>Ноды не зарегистрированы.</div></DashCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, alignItems: 'start' }}>
          <DashCard style={{ padding: 18 }}>
            <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>Зарегистрированные ноды</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {nodes.map((item) => (
                <button key={item.node_id} type="button" onClick={() => setSelectedId(item.node_id)} aria-current={selectedId === item.node_id ? 'true' : undefined} style={{ textAlign: 'left', cursor: 'pointer', padding: 12, color: colors.text, background: selectedId === item.node_id ? 'var(--accent-bg)' : 'var(--card-bg)', border: `1px solid ${selectedId === item.node_id ? 'var(--accent-border)' : colors.white[8]}`, borderRadius: 12 }}>
                  <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{item.node_id}</strong>
                  <span style={{ display: 'block', marginTop: 7, fontSize: 12, color: colors.white[4], overflowWrap: 'anywhere' }}>{item.address || 'Адрес не указан'}</span>
                  <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: colors.white[3] }}>Версия: {item.version || '—'}</span>
                  <span style={{ display: 'block', marginTop: 7, fontSize: 11, color: colors.white[4] }}>Heartbeat: {timestamp(item.heartbeat_at)}</span>
                  <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: colors.white[4] }}>Запущена: {timestamp(item.started_at)}</span>
                </button>
              ))}
            </div>
          </DashCard>

          <DashCard style={{ padding: 18, minWidth: 0 }}>
            {!selectedId ? <div style={{ color: colors.white[4], fontSize: 13 }}>Выберите ноду.</div> : detailLoading ? (
              <div role="status" style={{ color: colors.white[4], fontSize: 13 }}>Загружаем конфигурацию…</div>
            ) : node ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ fontSize: 16, margin: 0, overflowWrap: 'anywhere' }}>{node.node_id}</h2>
                    <div style={{ marginTop: 5, fontSize: 12, color: colors.white[4] }}>{node.address || 'Адрес не указан'} · {node.version || 'версия неизвестна'}</div>
                  </div>
                  {revision != null && <Pill>ревизия {revision}</Pill>}
                </div>
                <JsonEditor id="node-settings" label="Локальные настройки" value={settingsText} onChange={setSettingsText} disabled={settingsMasked} helper={settingsMasked ? 'Ответ содержит скрытый секрет. Редактирование этого JSON отключено, чтобы не затереть исходное значение.' : 'Изменяйте только если знаете формат конфигурации этой ноды.'} />
                <JsonEditor id="node-capabilities" label="Политики возможностей" value={capabilitiesText} onChange={setCapabilitiesText} helper="Объект JSON с политиками, поддерживаемыми этой нодой." />
                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                  <Button variant="accent" onClick={save} loading={saving} disabled={!dirty}>Сохранить</Button>
                  <Button onClick={() => loadNode(node.node_id)} disabled={saving}>Сбросить</Button>
                </div>
              </>
            ) : <div style={{ color: colors.white[4], fontSize: 13 }}>Данные ноды недоступны.</div>}
          </DashCard>
        </div>
      )}
    </div>
  )
}

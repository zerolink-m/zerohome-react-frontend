import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNode, listNodes, patchNode } from '../api/nodes'
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

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function cloneRecord(value) {
  return JSON.parse(JSON.stringify(asRecord(value)))
}

function timestamp(value) {
  if (value == null) return '—'
  const seconds = Number(value)
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toLocaleString() : String(value)
}

function isSensitive(key, value) {
  return SECRET_NAME.test(String(key)) || (typeof value === 'string' && MASKED_VALUE.test(value.trim()))
}

function flagValue(value) {
  return value === true || value === 1 || value === '1'
}

function setFlagValue(previous, next) {
  return typeof previous === 'number' ? (next ? 1 : 0) : Boolean(next)
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function ValueDisplay({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: colors.white[3], fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</div>
      <div style={{ color: colors.text, fontSize: 13, overflowWrap: 'anywhere' }}>{value ?? '—'}</div>
    </div>
  )
}

function SettingControl({ name, value, onChange }) {
  if (isSensitive(name, value)) {
    return (
      <div style={{ padding: 12, borderRadius: 10, border: `1px solid ${colors.statuses.yellow.border}`, background: colors.statuses.yellow.bg }}>
        <Pill variant="yellow">секрет скрыт</Pill>
        <div style={{ color: colors.statuses.yellow.text, fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>Это поле не редактируется: сервер не возвращает его исходное значение.</div>
      </div>
    )
  }

  if (typeof value === 'boolean') {
    return <Toggle checked={value} onChange={onChange} label={name} />
  }

  if (typeof value === 'number') {
    return <InputField label={name} type="number" step="any" value={value} onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))} />
  }

  if (typeof value === 'string') {
    return <InputField label={name} value={value} onChange={(event) => onChange(event.target.value)} />
  }

  return (
    <div>
      <div style={{ color: colors.white[4], fontSize: 12, marginBottom: 7 }}>{name} · только просмотр</div>
      <div style={{ margin: 0, padding: 12, borderRadius: 10, background: 'var(--card-bg)', border: `1px solid ${colors.white[8]}`, color: colors.white[4], fontSize: 12 }}>
        {value === null ? 'Пустое значение' : Array.isArray(value) ? `Массив · ${value.length} элементов` : `Объект · ${Object.keys(value).length} полей`}
      </div>
      <div style={{ color: colors.white[3], fontSize: 11, lineHeight: 1.5, marginTop: 7 }}>Структурированные значения отображаются без раскрытия содержимого и здесь не редактируются.</div>
    </div>
  )
}

function CapabilityCard({ name, policy, onChange }) {
  const item = asRecord(policy)
  const supported = flagValue(item.supported)
  const enabled = flagValue(item.enabled)
  const capacity = item.capacity ?? null

  return (
    <DashCard style={{ padding: 16, minWidth: 0 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 14px', overflowWrap: 'anywhere' }}>{name}</h3>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <div style={{ color: colors.white[3], fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Поддерживается</div>
          <Toggle checked={supported} onChange={(next) => onChange('supported', setFlagValue(item.supported, next))} label={`${name}: поддерживается`} />
        </div>
        <div>
          <div style={{ color: colors.white[3], fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Включено</div>
          <Toggle checked={enabled} onChange={(next) => onChange('enabled', setFlagValue(item.enabled, next))} label={`${name}: включено`} />
        </div>
        <div>
          <div style={{ color: colors.white[3], fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Ёмкость</div>
          <InputField label="Число или без лимита" type="number" min={0} step="any" value={capacity == null ? '' : capacity} placeholder="Без лимита" onChange={(event) => {
            const raw = event.target.value
            onChange('capacity', raw === '' ? null : Number(raw))
          }} />
          <div style={{ color: colors.white[3], fontSize: 11, marginTop: -12 }}>Пустое поле означает `null` — без лимита.</div>
        </div>
      </div>
    </DashCard>
  )
}

export default function AdminNodesPage() {
  const toast = useToast()
  const [nodes, setNodes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [node, setNode] = useState(null)
  const [settingsDraft, setSettingsDraft] = useState({})
  const [savedSettings, setSavedSettings] = useState({})
  const [capabilitiesDraft, setCapabilitiesDraft] = useState({})
  const [savedCapabilities, setSavedCapabilities] = useState({})
  const [revision, setRevision] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [restartRequired, setRestartRequired] = useState(false)
  const [editError, setEditError] = useState(null)
  const gate = useLoadGate(loading, loadError)

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
    setEditError(null)
    try {
      const result = await getNode(nodeId)
      const current = result.node
      const nextSettings = cloneRecord(current?.settings)
      const nextCapabilities = cloneRecord(current?.capabilities)
      setNode(current)
      setSettingsDraft(nextSettings)
      setSavedSettings(nextSettings)
      setCapabilitiesDraft(nextCapabilities)
      setSavedCapabilities(nextCapabilities)
      setRevision(result.revision)
    } catch (error) {
      toast.error(error.message || 'Не удалось загрузить конфигурацию ноды')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => { loadNodes() }, [])
  useEffect(() => { if (selectedId != null) loadNode(selectedId) }, [selectedId])

  function updateSetting(key, value) {
    setSettingsDraft((current) => ({ ...current, [key]: value }))
    setEditError(null)
  }

  function updateCapability(name, field, value) {
    setCapabilitiesDraft((current) => {
      const previous = current[name]
      const policy = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {}
      return { ...current, [name]: { ...policy, [field]: value } }
    })
    setEditError(null)
  }

  async function save() {
    if (!node) return
    const settingsPatch = {}
    for (const [key, value] of Object.entries(settingsDraft)) {
      if (isSensitive(key, value)) continue
      if (typeof savedSettings[key] === 'number' && value === '') {
        setEditError(`Настройка «${key}» должна быть числом.`)
        return
      }
      if (!sameJson(value, savedSettings[key])) settingsPatch[key] = value
    }

    for (const [name, rawPolicy] of Object.entries(capabilitiesDraft)) {
      const policy = asRecord(rawPolicy)
      const capacity = policy.capacity
      if (capacity !== null && capacity !== undefined && (!Number.isFinite(Number(capacity)) || Number(capacity) < 0)) {
        setEditError(`Ёмкость «${name}» должна быть неотрицательным числом или null.`)
        return
      }
    }

    const patch = {}
    if (Object.keys(settingsPatch).length) patch.settings = settingsPatch
    if (!sameJson(capabilitiesDraft, savedCapabilities)) patch.capabilities = capabilitiesDraft
    if (!Object.keys(patch).length) {
      toast.info('Изменений для сохранения нет')
      return
    }

    setSaving(true)
    setEditError(null)
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

  const settingsChanged = Object.entries(settingsDraft).some(([key, value]) => !isSensitive(key, value) && !sameJson(value, savedSettings[key]))
  const capabilitiesChanged = !sameJson(capabilitiesDraft, savedCapabilities)
  const dirty = settingsChanged || capabilitiesChanged

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

          <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12, marginTop: 16 }}>
                    <ValueDisplay label="Heartbeat" value={timestamp(node.heartbeat_at)} />
                    <ValueDisplay label="Запущена" value={timestamp(node.started_at)} />
                  </div>
                </>
              ) : <div style={{ color: colors.white[4], fontSize: 13 }}>Данные ноды недоступны.</div>}
            </DashCard>

            {node && !detailLoading && (
              <>
                <section aria-labelledby="node-settings-title">
                  <div style={{ margin: '0 0 12px' }}>
                    <h2 id="node-settings-title" style={{ fontSize: 16, margin: 0 }}>Локальные настройки</h2>
                    <p style={{ fontSize: 12, color: colors.white[4], lineHeight: 1.5, margin: '5px 0 0' }}>Изменённые скалярные ключи сохраняются отдельными значениями. Объекты доступны только для просмотра.</p>
                  </div>
                  {Object.keys(settingsDraft).length === 0 ? (
                    <DashCard><div style={{ color: colors.white[4], fontSize: 13 }}>Настроек нет.</div></DashCard>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                      {Object.entries(settingsDraft).map(([key, value]) => (
                        <DashCard key={key} style={{ padding: 14, minWidth: 0 }}>
                          <SettingControl name={key} value={value} onChange={(next) => updateSetting(key, next)} />
                        </DashCard>
                      ))}
                    </div>
                  )}
                </section>

                <section aria-labelledby="node-capabilities-title">
                  <div style={{ margin: '0 0 12px' }}>
                    <h2 id="node-capabilities-title" style={{ fontSize: 16, margin: 0 }}>Политики возможностей</h2>
                    <p style={{ fontSize: 12, color: colors.white[4], lineHeight: 1.5, margin: '5px 0 0' }}>Для каждой возможности можно изменить поддержку, активность и лимит ёмкости.</p>
                  </div>
                  {Object.keys(capabilitiesDraft).length === 0 ? (
                    <DashCard><div style={{ color: colors.white[4], fontSize: 13 }}>Политики возможностей не заданы.</div></DashCard>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
                      {Object.entries(capabilitiesDraft).map(([name, policy]) => (
                        <CapabilityCard key={name} name={name} policy={policy} onChange={(field, value) => updateCapability(name, field, value)} />
                      ))}
                    </div>
                  )}
                </section>

                {editError && <div role="alert" style={{ padding: 12, borderRadius: 10, border: `1px solid ${colors.statuses.red.border}`, background: colors.statuses.red.bg, color: colors.statuses.red.text, fontSize: 12 }}>{editError}</div>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Button variant="accent" onClick={save} loading={saving} disabled={!dirty}>Сохранить изменения</Button>
                  <Button onClick={() => loadNode(node.node_id)} disabled={saving}>Сбросить</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

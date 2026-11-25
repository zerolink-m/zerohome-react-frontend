import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { findDevicePreview } from '../api/snapshots'
import { getState } from '../api/authStore'
import { getSwitch, patchSwitch, deleteSwitch } from '../api/switches'
import { ApiError } from '../api/client'
import { CODES } from '../api/codes'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import DashCard from '../components/DashCard'
import Button from '../components/Button'
import InputField from '../components/InputField'
import SelectField from '../components/SelectField'
import Toggle from '../components/Toggle'
import Divider from '../components/Divider'
import ConfirmDialog from '../components/ConfirmDialog'
import AllowedUsersManager from '../components/cams/AllowedUsersManager'
import SharesManager from '../components/SharesManager'
import CollapsibleSection from '../components/CollapsibleSection'
import ShareLinkDialog from '../components/cams/ShareLinkDialog'
import StateToggle from '../components/switches/StateToggle'
import SwitchPushSettings from '../components/switches/SwitchPushSettings'
import ControlMetaTuyaLocal, { DEFAULT_TUYA_LOCAL } from '../components/switches/ControlMetaTuyaLocal'
import ControlMetaTuyaCloud, { DEFAULT_TUYA_CLOUD } from '../components/switches/ControlMetaTuyaCloud'
import ControlMetaCustom from '../components/switches/ControlMetaCustom'
import { customFormToControlmeta, controlmetaToCustomForm } from '../utils/controlmeta'
import { colors } from '../styles/tokens'
import { formatUnixTs } from '../utils/format'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from '../components/PageLoader'

const TABS = [
  { key: 'main', label: 'Главное' },
  { key: 'control', label: 'Протокол управления' },
  { key: 'notify', label: 'Уведомления (устаревшее)' },
  { key: 'push-settings', label: 'Настройки уведомлений' },
  { key: 'share', label: 'Доступ' },
]

const PROTO_LABELS = {
  tuya_local: 'Tuya (локально)',
  tuya_cloud: 'Tuya (облако)',
  custom: 'Custom HTTP',
}
const PROTO_OPTIONS = Object.entries(PROTO_LABELS).map(([value, label]) => ({ value, label }))

function controlmetaToForm(proto, meta) {
  if (proto === 'custom') return controlmetaToCustomForm(meta)
  if (proto === 'tuya_cloud') return { ...DEFAULT_TUYA_CLOUD, ...meta }
  return { ...DEFAULT_TUYA_LOCAL, ...meta }
}

export default function SwitchDetailPage() {
  const { id } = useParams()
  const { uid, role } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const preview = findDevicePreview(uid, 'switches', id, location.state)
  const [switchItem, setSwitchItem] = useState(null)
  const [verifiedId, setVerifiedId] = useState(null)
  const current = verifiedId === `${uid}:${id}`
  const displaySwitch = current ? switchItem : preview
  const [loading, setLoading] = useState(true)
  const gate = useLoadGate(loading)
  const [editing, setEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('main')
  const [name, setName] = useState('')
  const [notify, setNotify] = useState(0)
  const [controlMetadata, setControlMetadata] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmSave, setConfirmSave] = useState(false)
  const [confirmEnabled, setConfirmEnabled] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [sharesRefresh, setSharesRefresh] = useState(0)

  const canManage = current && !!switchItem && (role === 'admin' || switchItem.owner === uid)
  const hasFullData = current && !!switchItem && 'control_metadata' in switchItem
  // tuya_cloud-выключатели заводятся только автоматически из соединений:
  // их control_metadata редактировать нельзя, и удалять напрямую тоже.
  const isAuto = !!switchItem && switchItem.control_protocol === 'tuya_cloud'

  async function load() {
    setLoading(true)
    try {
      const data = await getSwitch(id)
      if (getState().uid !== uid) return
      setSwitchItem(data)
      setVerifiedId(`${uid}:${id}`)
      setName(data.name || '')
      setNotify(data.notify ? 1 : 0)
      if ('control_metadata' in data) {
        setControlMetadata(controlmetaToForm(data.control_protocol, data.control_metadata))
      }
    } catch (e) {
      toast.error(e.message)
      navigate('/switches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, uid])

  async function toggleEnabled() {
    try {
      const updated = await patchSwitch(id, { enabled: switchItem.enabled ? 0 : 1 })
      setSwitchItem(updated)
      toast.success('Статус выключателя обновлён')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setConfirmEnabled(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body = { name, notify: Number(notify) }
      if (activeTab === 'control' && controlMetadata && !isAuto) {
        try {
          body.control_protocol = switchItem.control_protocol
          body.control_metadata =
            switchItem.control_protocol === 'custom' ? customFormToControlmeta(controlMetadata) : controlMetadata
        } catch (err) {
          toast.error(err.message)
          setSaving(false)
          setConfirmSave(false)
          return
        }
      }
      const updated = await patchSwitch(id, body)
      setSwitchItem(updated)
      if ('control_metadata' in updated) {
        setControlMetadata(controlmetaToForm(updated.control_protocol, updated.control_metadata))
      }
      setEditing(false)
      toast.success('Выключатель обновлён')
    } catch (e) {
      if (e instanceof ApiError && e.code === CODES.TUYA_LOCAL_NOT_ALLOWED) {
        toast.error('Локальное управление Tuya недоступно для вашего аккаунта')
      } else if (e instanceof ApiError && e.code === CODES.FORBIDDEN_RESOURCE) {
        toast.error(
          'Это авто-выключатель, полученный из соединения. Изменять можно только название, статус и уведомления.',
        )
      } else {
        toast.error(e.message)
      }
    } finally {
      setSaving(false)
      setConfirmSave(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteSwitch(id)
      toast.success('Выключатель удалён')
      navigate('/switches')
    } catch (e) {
      if (e instanceof ApiError && e.code === CODES.FORBIDDEN_RESOURCE) {
        toast.error(
          'Авто-выключатель нельзя удалить напрямую — удалите его в приложении провайдера или удалите соединение.',
        )
      } else {
        toast.error(e.message)
      }
      setDeleting(false)
    }
  }

  if (!current && displaySwitch) return (
    <div style={{ display: 'grid', gap: 16 }}>
      <DashCard>
        <h1 style={{ fontSize: 20 }}>{displaySwitch.name || `Выключатель #${id}`}</h1>
        <div style={{ fontSize: 12, color: colors.white[4], marginTop: 8 }}>
          #{id} · {displaySwitch.control_protocol || '—'} · владелец #{displaySwitch.owner}
        </div>
        <div role="status" style={{ fontSize: 12, color: colors.white[4], marginTop: 12 }}>Обновляем сведения о выключателе…</div>
      </DashCard>
      <div>Добавлен: {formatUnixTs(displaySwitch.added_at)} · Обновлён: {formatUnixTs(displaySwitch.updated_at)}</div>
    </div>
  )
  if (gate.busy) return <PageLoader gate={gate} />
  if (!current || !switchItem) return null

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, marginBottom: 4, wordBreak: 'break-all' }}>
            {switchItem.name || `Выключатель #${switchItem.id}`}
          </h1>
          <span style={{ fontSize: 12, color: colors.white[3] }}>
            id: {switchItem.id} · {switchItem.control_protocol}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button onClick={() => navigate('/#switches')}>← к списку</Button>
          {canManage && <Toggle aria-label="Выключатель включён" checked={!!switchItem.enabled} onChange={() => setConfirmEnabled(true)} />}
          {canManage && (
            <Button
              onClick={() => {
                setEditing((v) => !v)
                setActiveTab('main')
              }}
            >
              {editing ? 'Отменить' : 'Редактировать'}
            </Button>
          )}
          {canManage && !isAuto && <Button onClick={() => setConfirmDelete(true)}>Удалить</Button>}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        <DashCard style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: colors.white[3], marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Состояние устройства
          </div>
          <StateToggle switchId={switchItem.id} large={!Array.isArray(switchItem.control_metadata?.dp_codes) || switchItem.control_metadata.dp_codes.length <= 1} />
        </DashCard>

        {current && !!switchItem && !canManage && (
          <DashCard>
            <CollapsibleSection key={switchItem.id} title="Настройки уведомлений">
              <SwitchPushSettings switchId={switchItem.id} />
            </CollapsibleSection>
          </DashCard>
        )}

        {canManage && editing && (
          <DashCard>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {TABS.map((tab) => (
                <Button
                  key={tab.key}
                  small
                  variant={activeTab === tab.key ? 'accent' : 'default'}
                  aria-pressed={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {activeTab === 'main' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setConfirmSave(true)
                }}
              >
                <InputField
                  label="Название"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Свет в коридоре"
                />
                <Button variant="accent" type="submit" loading={saving}>
                  Сохранить
                </Button>
              </form>
            )}

            {activeTab === 'control' && hasFullData && controlMetadata && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (isAuto) return
                  setConfirmSave(true)
                }}
              >
                <SelectField
                  label="Протокол"
                  value={switchItem.control_protocol}
                  onChange={() => {}}
                  options={PROTO_OPTIONS}
                  disabled
                />
                {switchItem.control_protocol === 'tuya_local' && (
                  <ControlMetaTuyaLocal value={controlMetadata} onChange={setControlMetadata} disabled={isAuto} />
                )}
                {switchItem.control_protocol === 'tuya_cloud' && (
                  <ControlMetaTuyaCloud value={controlMetadata} onChange={setControlMetadata} disabled={isAuto} />
                )}
                {switchItem.control_protocol === 'custom' && (
                  <ControlMetaCustom value={controlMetadata} onChange={setControlMetadata} disabled={isAuto} />
                )}
                {!isAuto && (
                  <Button variant="accent" type="submit" loading={saving}>
                    Сохранить
                  </Button>
                )}
              </form>
            )}
            {activeTab === 'control' && !hasFullData && (
              <div style={{ fontSize: 12, color: colors.white[4] }}>Недоступно для этого аккаунта</div>
            )}

            {activeTab === 'notify' && hasFullData && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setConfirmSave(true)
                }}
              >
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 6 }}>
                    Уведомления о событиях выключателя
                  </label>
                  <Toggle aria-label="Уведомления о выключателе" checked={notify === 1} onChange={(v) => setNotify(v ? 1 : 0)} />
                </div>
                <Button variant="accent" type="submit" loading={saving}>
                  Сохранить
                </Button>
              </form>
            )}
            {activeTab === 'notify' && !hasFullData && (
              <div style={{ fontSize: 12, color: colors.white[4] }}>Недоступно для этого аккаунта</div>
            )}

            {activeTab === 'push-settings' && (
              <SwitchPushSettings switchId={switchItem.id} />
            )}

            {activeTab === 'share' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <AllowedUsersManager switchId={switchItem.id} deviceType="switches" />
                <Divider />
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: colors.white[3],
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      Активные ссылки
                    </div>
                    <Button small onClick={() => setSharing(true)}>
                      Создать новую ссылку
                    </Button>
                  </div>
                  <SharesManager deviceId={switchItem.id} deviceType="switches" refreshKey={sharesRefresh} />
                </div>
              </div>
            )}
          </DashCard>
        )}

        <div style={{ fontSize: 11, color: colors.white[2] }}>
          Добавлен: {formatUnixTs(switchItem.added_at)} · Обновлён: {formatUnixTs(switchItem.updated_at)}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить выключатель?"
        message="Устройство будет удалено без возможности восстановления."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <ConfirmDialog
        open={confirmEnabled}
        title={switchItem.enabled ? 'Выключить устройство?' : 'Включить устройство?'}
        message={
          switchItem.enabled
            ? 'Управление устройством станет недоступно.'
            : 'Устройство станет доступно для управления.'
        }
        confirmLabel={switchItem.enabled ? 'Выключить' : 'Включить'}
        onCancel={() => setConfirmEnabled(false)}
        onConfirm={toggleEnabled}
      />

      <ConfirmDialog
        open={confirmSave}
        title="Сохранить изменения?"
        message="Настройки выключателя будут обновлены."
        confirmLabel="Сохранить"
        onCancel={() => setConfirmSave(false)}
        onConfirm={handleSave}
        loading={saving}
      />

      <ShareLinkDialog
        open={sharing}
        switchId={switchItem.id}
        deviceType="switches"
        type="device_use"
        sharePath={(id) => `/share/switch/${id}`}
        onCreated={() => setSharesRefresh((v) => v + 1)}
        onClose={() => setSharing(false)}
      />
    </div>
  )
}

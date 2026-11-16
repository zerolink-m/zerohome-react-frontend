import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { findDevicePreview } from '../api/snapshots'
import { getState } from '../api/authStore'
import { getCam, patchCam, deleteCam } from '../api/cams'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import DashCard from '../components/DashCard'
import Button from '../components/Button'
import InputField from '../components/InputField'
import Toggle from '../components/Toggle'
import Divider from '../components/Divider'
import ConfirmDialog from '../components/ConfirmDialog'
import AllowedUsersManager from '../components/cams/AllowedUsersManager'
import RecordingSettings from '../components/cams/RecordingSettings'
import SharesManager from '../components/SharesManager'
import MotionDetection from '../components/cams/MotionDetection'
import PushSettings from '../components/cams/PushSettings'
import OnvifSettings from '../components/cams/OnvifSettings'
import MotionEventsCard from '../components/cams/MotionEventsCard'
import { colors } from '../styles/tokens'
import { formatUnixTs } from '../utils/format'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from '../components/PageLoader'

const EMPTY_FORM = {
  name: '',
  address: '',
  port: '',
  path: '',
  username: '',
  password: '',
  control_protocol: '',
  control_address: '',
  control_port: '',
  control_username: '',
  control_password: '',
  notify: 0,
}

const TABS = [
  { key: 'main', label: 'Главное' },
  { key: 'stream', label: 'Поток' },
  { key: 'control', label: 'Контроль (ONVIF)' },
  { key: 'recording', label: 'Управление записью' },
  { key: 'motion', label: 'Детекция движения' },
  { key: 'push-settings', label: 'Настройки уведомлений' },
  { key: 'share', label: 'Поделиться' },
]

export default function CamDetailPage() {
  const { id } = useParams()
  const { uid, role, profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const preview = findDevicePreview(uid, 'cams', id, location.state)
  const [cam, setCam] = useState(null)
  const [verifiedId, setVerifiedId] = useState(null)
  const current = verifiedId === `${uid}:${id}`
  const displayCam = current ? cam : preview
  const [loading, setLoading] = useState(true)
  const gate = useLoadGate(loading)
  const [editing, setEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('main')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmSave, setConfirmSave] = useState(false)
  const [confirmEnabled, setConfirmEnabled] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)

  const canManage = current && !!cam && (role === 'admin' || cam.owner === uid)
  const hasFullData = current && !!cam && 'username' in cam

  async function load() {
    setLoading(true)
    try {
      const data = await getCam(id)
      if (getState().uid !== uid) return
      setCam(data)
      setVerifiedId(`${uid}:${id}`)
      setForm({
        name: data.name || '',
        address: data.address || '',
        port: data.port ?? '',
        path: data.path || '',
        username: data.username ?? '',
        password: data.password ?? '',
        control_protocol: data.control_protocol || '',
        control_address: data.control_address || '',
        control_port: data.control_port ?? '',
        control_username: data.control_username || '',
        control_password: data.control_password || '',
        notify: data.notify ? 1 : 0,
      })
    } catch (e) {
      toast.error(e.message)
      navigate('/')
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
      const updated = await patchCam(id, { enabled: cam.enabled ? 0 : 1 })
      setCam(updated)
      toast.success('Статус камеры обновлён')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setConfirmEnabled(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body = {
        name: form.name,
        address: form.address,
        port: Number(form.port),
        path: form.path,
        username: form.username,
        password: form.password,
        control_protocol: form.control_protocol || null,
        control_address: form.control_protocol ? form.control_address : null,
        control_port: form.control_protocol && form.control_port !== '' ? Number(form.control_port) : null,
        control_username: form.control_protocol ? form.control_username : null,
        control_password: form.control_protocol ? form.control_password : null,
      }
      const updated = await patchCam(id, body)
      setCam(updated)
      setEditing(false)
      toast.success('Камера обновлена')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
      setConfirmSave(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteCam(id)
      toast.success('Камера удалена')
      navigate('/')
    } catch (e) {
      toast.error(e.message)
      setDeleting(false)
    }
  }

  // Сразу показываем безопасные поля ранее загруженной карточки. Серверный
  // getCam обновляет их в фоне; управление доступно лишь после его ответа.
  if (!displayCam) return <PageLoader gate={gate} />

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
            {displayCam.name || `Камера #${id}`}
          </h1>
          {displayCam.name && (
            <div style={{ fontSize: 12, color: colors.white[4], marginBottom: 4, wordBreak: 'break-all' }}>
              {displayCam.address || '—'}{displayCam.port ? `:${displayCam.port}` : ''}
              {displayCam.path || ''}
            </div>
          )}
          <span style={{ fontSize: 12, color: colors.white[3] }}>
            id: {displayCam.id} · {displayCam.protocol || '—'}
          </span>
          {!current && <div role="status" style={{ fontSize: 12, color: colors.white[4], marginTop: 8 }}>Обновляем сведения о камере…</div>}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button onClick={() => navigate('/#cams')}>← к списку</Button>
          {canManage && <Toggle checked={!!cam.enabled} onChange={() => setConfirmEnabled(true)} />}
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
          {canManage && <Button onClick={() => setConfirmDelete(true)}>Удалить</Button>}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        <DashCard style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              maxWidth: 320,
              margin: '0 auto',
            }}
          >
            <Button variant="accent" onClick={() => navigate(`/cams/${displayCam.id}/live`)}>
              Перейти к просмотру{' '}
              <span style={{ color: colors.statuses.red.text, fontWeight: 700 }}>LIVE</span>{' '}
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: colors.statuses.red.text,
                }}
              />
            </Button>
            <Button
              onClick={() => navigate(`/cams/${displayCam.id}/recordings`)}
              disabled={!current || cam.record !== 1}
              title={!current ? 'Архив станет доступен после обновления данных' : cam.record !== 1 ? 'Запись для этой камеры не настроена' : undefined}
              style={{ color: colors.statuses.blue.text }}
            >
              Просмотр архива
            </Button>
          </div>
        </DashCard>

        {/* События движения: между панелью просмотра и учётными данными; только при включённой детекции */}
        {current && !editing && <MotionEventsCard camId={cam.id} />}

        {canManage && editing && (
          <DashCard>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {TABS.map((tab) => (
                <Button
                  key={tab.key}
                  small
                  variant={activeTab === tab.key ? 'accent' : 'default'}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {(activeTab === 'main' || activeTab === 'stream' || activeTab === 'control') && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setConfirmSave(true)
                }}
              >
                {activeTab === 'main' && (
                  <InputField
                    label="Название"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Камера у входа"
                  />
                )}

                {activeTab === 'stream' && (
                  <>
                    <InputField
                      label="Адрес потока"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                    <InputField
                      label="Порт потока"
                      type="number"
                      value={form.port}
                      onChange={(e) => setForm({ ...form, port: e.target.value })}
                    />
                    <InputField
                      label="Путь потока"
                      value={form.path}
                      onChange={(e) => setForm({ ...form, path: e.target.value })}
                      placeholder="/stream1"
                    />
                    <InputField
                      label="RTSP логин"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                    <InputField
                      label="RTSP пароль"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </>
                )}

                {activeTab === 'control' && (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 6 }}>
                        ONVIF
                      </label>
                      <Toggle
                        checked={form.control_protocol === 'onvif'}
                        onChange={(v) => setForm({ ...form, control_protocol: v ? 'onvif' : '' })}
                      />
                    </div>
                    {form.control_protocol && (
                      <>
                        <InputField
                          label="ONVIF адрес"
                          value={form.control_address}
                          onChange={(e) => setForm({ ...form, control_address: e.target.value })}
                        />
                        <InputField
                          label="ONVIF порт"
                          type="number"
                          value={form.control_port}
                          onChange={(e) => setForm({ ...form, control_port: e.target.value })}
                        />
                        <InputField
                          label="ONVIF логин"
                          value={form.control_username}
                          onChange={(e) => setForm({ ...form, control_username: e.target.value })}
                        />
                        <InputField
                          label="ONVIF пароль"
                          value={form.control_password}
                          onChange={(e) => setForm({ ...form, control_password: e.target.value })}
                        />
                      </>
                    )}
                  </>
                )}

                <Button variant="accent" type="submit" loading={saving}>
                  Сохранить
                </Button>
              </form>
            )}

            {activeTab === 'control' && canManage && (
              <>
                <Divider />
                <OnvifSettings camId={cam.id} initialSettings={cam} />
              </>
            )}

            {activeTab === 'recording' &&
              (profile?.allow_record === 1 ? (
                <RecordingSettings camId={cam.id} />
              ) : (
                <div style={{ fontSize: 12, color: colors.white[4] }}>Запись недоступна для этого аккаунта</div>
              ))}

            {activeTab === 'share' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <AllowedUsersManager camId={cam.id} deviceType="cams" />
                <Divider />
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: colors.white[3],
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      marginBottom: 12,
                    }}
                  >
                    Активные ссылки
                  </div>
                  <SharesManager deviceId={cam.id} deviceType="cams" />
                </div>
              </div>
            )}

            {activeTab === 'motion' && canManage && (
              <MotionDetection camId={cam.id} />
            )}

            {activeTab === 'push-settings' && (
              <PushSettings
                camId={cam.id}
                section="general"
                onSyncNotify={async (value) => {
                  // «Включить уведомления» = push-настройка enabled + флаг камеры notify.
                  if (!hasFullData) return
                  const updated = await patchCam(id, { notify: value })
                  setCam(updated)
                  setForm((f) => ({ ...f, notify: updated.notify ? 1 : 0 }))
                }}
              />
            )}
          </DashCard>
        )}

        {canManage && hasFullData && !editing && (
          <DashCard>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <h3 style={{ fontSize: 16 }}>Учётные данные</h3>
              <Button small onClick={() => setShowSecrets((v) => !v)}>
                {showSecrets ? 'скрыть' : 'показать'}
              </Button>
            </div>
            <div style={{ fontSize: 12, color: colors.white[4], lineHeight: 2 }}>
              <div>Путь потока: {cam.path || '—'}</div>
              <div>RTSP логин: {cam.username}</div>
              <div>RTSP пароль: {showSecrets ? cam.password : '••••••'}</div>
              {cam.control_protocol && (
                <>
                  <Divider />
                  <div>
                    ONVIF адрес: {cam.control_address}:{cam.control_port}
                  </div>
                  <div>ONVIF логин: {cam.control_username}</div>
                  <div>ONVIF пароль: {showSecrets ? cam.control_password : '••••••'}</div>
                </>
              )}
            </div>
          </DashCard>
        )}

        <div style={{ fontSize: 11, color: colors.white[2] }}>
          Добавлена: {formatUnixTs(displayCam.added_at)} · Обновлена: {formatUnixTs(displayCam.updated_at)}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить камеру?"
        message="Активный видеопоток будет остановлен, камера будет удалена без возможности восстановления."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <ConfirmDialog
        open={confirmEnabled}
        title={cam?.enabled ? 'Выключить камеру?' : 'Включить камеру?'}
        message={
          cam?.enabled
            ? 'Активный видеопоток и запись будут остановлены.'
            : 'Камера станет доступна для просмотра и записи.'
        }
        confirmLabel={cam?.enabled ? 'Выключить' : 'Включить'}
        onCancel={() => setConfirmEnabled(false)}
        onConfirm={toggleEnabled}
      />

      <ConfirmDialog
        open={confirmSave}
        title="Сохранить изменения камеры?"
        message="Настройки камеры будут обновлены."
        confirmLabel="Сохранить"
        onCancel={() => setConfirmSave(false)}
        onConfirm={handleSave}
        loading={saving}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getConnection,
  patchConnection,
  deleteConnection,
  syncConnection,
  TUYA_ENDPOINTS,
} from '../api/connections'
import { describeApiError } from '../api/client'
import { useToast } from '../context/ToastContext'
import DashCard from '../components/DashCard'
import Button from '../components/Button'
import InputField from '../components/InputField'
import SelectField from '../components/SelectField'
import Toggle from '../components/Toggle'
import ConfirmDialog from '../components/ConfirmDialog'
import { colors } from '../styles/tokens'
import { formatUnixTs } from '../utils/format'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from '../components/PageLoader'

const PROVIDER_LABELS = { tuya_cloud: 'Tuya Cloud' }
const DEFAULT_ENDPOINT = 'eu'

export default function ConnectionDetailPage() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()

  const [connection, setConnection] = useState(null)
  const [loading, setLoading] = useState(true)
  const gate = useLoadGate(loading)

  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(1)
  const [savingMain, setSavingMain] = useState(false)

  const [accessId, setAccessId] = useState('')
  const [accessSecret, setAccessSecret] = useState('')
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT)
  const [tuyaUid, setTuyaUid] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

  const [syncing, setSyncing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await getConnection(id)
      applyConnection(data)
    } catch (e) {
      toast.error(describeApiError(e))
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  function applyConnection(data) {
    setConnection(data)
    setName(data.name || '')
    setEnabled(data.enabled ? 1 : 0)
    const meta = data.meta || {}
    setAccessId(meta.access_id || '')
    setEndpoint(meta.endpoint || DEFAULT_ENDPOINT)
    setTuyaUid(meta.tuya_uid || '')
    setAccessSecret('') // никогда не префиллим секрет
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSaveMain(e) {
    e.preventDefault()
    setSavingMain(true)
    try {
      const updated = await patchConnection(id, {
        name,
        enabled: Number(enabled),
      })
      applyConnection(updated)
      toast.success('Соединение обновлено')
    } catch (err) {
      toast.error(describeApiError(err))
    } finally {
      setSavingMain(false)
    }
  }

  async function handleSaveMeta(e) {
    e.preventDefault()
    // Если access_secret пустой — meta не меняем, значит запрос отправлять нечего.
    if (!accessSecret) {
      toast.error('Заполните access_secret, если хотите обновить учётные данные.')
      return
    }
    if (!accessId || !endpoint) {
      toast.error('Заполните все поля Tuya, если хотите обновить учётные данные.')
      return
    }
    setSavingMeta(true)
    try {
      const updated = await patchConnection(id, {
        meta: {
          access_id: accessId,
          access_secret: accessSecret,
          endpoint,
          ...(tuyaUid ? { tuya_uid: tuyaUid } : {}),
        },
      })
      applyConnection(updated)
      toast.success('Учётные данные обновлены')
    } catch (err) {
      toast.error(describeApiError(err))
    } finally {
      setSavingMeta(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const updated = await syncConnection(id)
      applyConnection(updated)
      toast.success('Синхронизация выполнена')
    } catch (err) {
      toast.error(describeApiError(err))
    } finally {
      setSyncing(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteConnection(id)
      toast.success('Соединение удалено')
      navigate('/')
    } catch (err) {
      toast.error(describeApiError(err))
      setDeleting(false)
    }
  }

  if (gate.busy) return <PageLoader gate={gate} />
  if (!connection) return null

  const providerLabel = PROVIDER_LABELS[connection.provider] || connection.provider

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
            {connection.name || `Соединение #${connection.id}`}
          </h1>
          <span style={{ fontSize: 12, color: colors.white[3] }}>
            id: {connection.id} · {providerLabel}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button onClick={() => navigate('/#connections')}>← к списку</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        <DashCard>
          <div
            style={{
              fontSize: 11,
              color: colors.white[3],
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 16,
            }}
          >
            Информация
          </div>
          <form onSubmit={handleSaveMain}>
            <InputField
              label="Название"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Мой Tuya-аккаунт"
            />
            <InputField label="Провайдер" value={providerLabel} onChange={() => {}} disabled />
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 6 }}>
                Включено
              </label>
              <Toggle checked={enabled === 1} onChange={(v) => setEnabled(v ? 1 : 0)} />
            </div>
            <Button variant="accent" type="submit" loading={savingMain}>
              Сохранить
            </Button>
          </form>
        </DashCard>

        <DashCard>
          <div
            style={{
              fontSize: 11,
              color: colors.white[3],
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 16,
            }}
          >
            Учётные данные (Tuya Cloud)
          </div>
          <form onSubmit={handleSaveMeta}>
            <InputField
              label="Access ID"
              value={accessId}
              onChange={(e) => setAccessId(e.target.value)}
            />
            <InputField
              label="Access secret"
              type="password"
              value={accessSecret}
              onChange={(e) => setAccessSecret(e.target.value)}
              placeholder="оставьте пустым, чтобы не менять"
            />
            <SelectField
              label="Регион (endpoint)"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              options={TUYA_ENDPOINTS}
            />
            <InputField
              label="Tuya UID"
              value={tuyaUid}
              onChange={(e) => setTuyaUid(e.target.value)}
            />
            <div style={{ fontSize: 11, color: colors.white[3], marginTop: -12, marginBottom: 16 }}>
              Без tuya_uid синхронизация не сможет работать. Меняем meta целиком: если хотите
              обновить учётные данные, заполните все поля.
            </div>
            <Button variant="accent" type="submit" loading={savingMeta}>
              Обновить учётные данные
            </Button>
          </form>
        </DashCard>

        <DashCard>
          <div
            style={{
              fontSize: 11,
              color: colors.white[3],
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 16,
            }}
          >
            Синхронизация
          </div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            Последняя синхронизация:{' '}
            <span style={{ color: colors.white[3] }}>
              {connection.last_synced_at ? formatUnixTs(connection.last_synced_at) : '—'}
            </span>
          </div>
          {connection.last_sync_error && (
            <div
              style={{
                fontSize: 12,
                color: colors.statuses.red.text,
                marginBottom: 16,
                wordBreak: 'break-all',
              }}
            >
              Ошибка: {connection.last_sync_error}
            </div>
          )}
          <Button variant="accent" onClick={handleSync} loading={syncing} disabled={syncing}>
            Синхронизировать сейчас
          </Button>
        </DashCard>

        <DashCard>
          <div
            style={{
              fontSize: 11,
              color: colors.white[3],
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 12,
            }}
          >
            Удаление
          </div>
          <div style={{ fontSize: 12, color: colors.white[4], marginBottom: 12 }}>
            Удаление соединения также удалит все связанные с ним авто-выключатели.
          </div>
          <Button
            onClick={() => setConfirmDelete(true)}
            style={{
              background: 'var(--status-red-bg)',
              border: '1px solid var(--status-red-border)',
              color: 'var(--status-red-text)',
            }}
          >
            Удалить соединение
          </Button>
        </DashCard>

        <div style={{ fontSize: 11, color: colors.white[2] }}>
          Добавлено: {formatUnixTs(connection.added_at)} · Обновлено:{' '}
          {formatUnixTs(connection.updated_at)}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить соединение?"
        message="Удалить соединение и все связанные auto-выключатели?"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}

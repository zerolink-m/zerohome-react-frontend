import { useEffect, useState } from 'react'
import { listUsers, createUser, patchUser, deleteUser } from '../api/users'
import { useToast } from '../context/ToastContext'
import { SEARCH_COLUMNS, SEARCH_COLUMN_LABELS, DEFAULT_LIMIT } from '../api/pagination'
import DashCard from '../components/DashCard'
import Button from '../components/Button'
import InputField from '../components/InputField'
import SelectField from '../components/SelectField'
import SearchBar from '../components/SearchBar'
import Pagination from '../components/Pagination'
import Pill from '../components/Pill'
import Toggle from '../components/Toggle'
import ConfirmDialog from '../components/ConfirmDialog'
import { colors } from '../styles/tokens'
import { formatUnixTs } from '../utils/format'
import { useLoadGate } from '../hooks/useLoadGate'
import PageLoader from '../components/PageLoader'

const EMPTY = { name: '', surname: '', email: '', password: '', role: 'user' }

function UserForm({ initial, onSubmit, onCancel, submitLabel, isEdit }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = { name: form.name, surname: form.surname, email: form.email, role: form.role }
      if (form.password || !isEdit) body.password = form.password
      if (isEdit) {
        body.allow_record = Number(form.allow_record)
        body.allow_tuya_local = Number(form.allow_tuya_local)
        body.motion_detection_allowed = Number(form.motion_detection_allowed)
      }
      await onSubmit(body)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <InputField label="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <InputField
        label="Фамилия"
        value={form.surname}
        onChange={(e) => setForm({ ...form, surname: e.target.value })}
      />
      <InputField
        label="Email"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <InputField
        label={isEdit ? 'Новый пароль' : 'Пароль'}
        type="password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        placeholder={isEdit ? 'оставьте пустым, если не меняете' : undefined}
      />
      <SelectField
        label="Роль"
        value={form.role}
        onChange={(e) => setForm({ ...form, role: e.target.value })}
        options={[
          { value: 'user', label: 'user' },
          { value: 'admin', label: 'admin' },
        ]}
      />
      {isEdit && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: colors.white[4], display: 'block', marginBottom: 8 }}>
              Разрешить запись
            </label>
            <Toggle
              aria-label="Разрешить запись"
              checked={form.allow_record === 1}
              onChange={(v) => setForm({ ...form, allow_record: v ? 1 : 0 })}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: colors.white[4], display: 'block', marginBottom: 8 }}>
              Разрешить Tuya Local
            </label>
            <Toggle
              aria-label="Разрешить Tuya Local"
              checked={form.allow_tuya_local === 1}
              onChange={(v) => setForm({ ...form, allow_tuya_local: v ? 1 : 0 })}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: colors.white[4], display: 'block', marginBottom: 8 }}>
              Разрешить детекцию движения
            </label>
            <Toggle
              aria-label="Разрешить детекцию движения"
              checked={form.motion_detection_allowed === 1}
              onChange={(v) => setForm({ ...form, motion_detection_allowed: v ? 1 : 0 })}
            />
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="accent" type="submit" loading={saving}>
          {submitLabel}
        </Button>
        <Button type="button" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  )
}

export default function AdminUsersPage() {
  const toast = useToast()
  const [filter, setFilter] = useState({ offset: 0, limit: DEFAULT_LIMIT })
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const gate = useLoadGate(loading, loadError)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await listUsers(filter)
      setData(res)
    } catch (e) {
      toast.error(e.message)
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  async function handleCreate(body) {
    try {
      await createUser(body)
      toast.success('Пользователь создан')
      setCreating(false)
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function handleEdit(id, body) {
    try {
      await patchUser(id, body)
      toast.success('Пользователь обновлён')
      setEditingId(null)
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteUser(deleteTarget.id)
      toast.success('Пользователь удалён')
      setDeleteTarget(null)
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1 style={{ fontSize: 20 }}>Пользователи</h1>
        <Button
          variant="accent"
          onClick={() => {
            setCreating((v) => !v)
            setEditingId(null)
          }}
        >
          {creating ? 'Отменить' : '+ Добавить пользователя'}
        </Button>
      </div>

      {creating && (
        <DashCard style={{ marginBottom: 24, maxWidth: 480 }}>
          <UserForm initial={EMPTY} onSubmit={handleCreate} onCancel={() => setCreating(false)} submitLabel="Создать" isEdit={false} />
        </DashCard>
      )}

      <SearchBar
        columns={SEARCH_COLUMNS.users}
        labels={SEARCH_COLUMN_LABELS.users}
        onSearch={(patch) => setFilter((f) => ({ ...f, offset: 0, ...patch }))}
      />

      {gate.busy ? (
        <PageLoader gate={gate} onRetry={load} />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {data.items.map((u) => (
            <DashCard key={u.id} style={{ padding: 16 }}>
              {editingId === u.id ? (
                <UserForm
                  initial={{
                    name: u.name,
                    surname: u.surname,
                    email: u.email,
                    password: '',
                    role: u.role,
                    allow_record: u.allow_record ?? 0,
                    allow_tuya_local: u.allow_tuya_local ?? 0,
                    motion_detection_allowed: u.motion_detection_allowed ?? 0,
                  }}
                  onSubmit={(body) => handleEdit(u.id, body)}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Сохранить"
                  isEdit
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: 12 }}>
                    <div style={{ fontSize: 14, marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                      {u.name} {u.surname} <Pill variant={u.role === 'admin' ? 'blue' : 'default'}>{u.role}</Pill>
                    </div>
                    <div style={{ color: colors.white[4] }}>{u.email}</div>
                    <div style={{ color: colors.white[2] }}>
                      id: {u.id} · создан {formatUnixTs(u.added_at)}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      {u.allow_record === 1 && <Pill variant="green">Запись</Pill>}
                      {u.allow_tuya_local === 1 && <Pill variant="blue">Tuya Local</Pill>}
                      {u.motion_detection_allowed === 1 && <Pill variant="orange">Детекция движения</Pill>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button to={`/admin/users/${u.id}/sessions`} small>Сессии</Button>
                    <Button
                      small
                      onClick={() => {
                        setEditingId(u.id)
                        setCreating(false)
                      }}
                    >
                      Редактировать
                    </Button>
                    <Button small onClick={() => setDeleteTarget(u)}>
                      Удалить
                    </Button>
                  </div>
                </div>
              )}
            </DashCard>
          ))}
        </div>
      )}

      <Pagination
        offset={filter.offset}
        limit={filter.limit}
        total={data.total}
        onChange={(patch) => setFilter((f) => ({ ...f, ...patch }))}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить пользователя?"
        message={
          deleteTarget
            ? `Пользователь ${deleteTarget.email} и все его камеры/сессии будут удалены без возможности восстановления.`
            : ''
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}

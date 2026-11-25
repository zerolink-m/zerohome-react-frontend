import { useState } from 'react'
import { useNavigate } from 'react-router'
import { createCam } from '../api/cams'
import { useToast } from '../context/ToastContext'
import DashCard from '../components/DashCard'
import InputField from '../components/InputField'
import SelectField from '../components/SelectField'
import Toggle from '../components/Toggle'
import Button from '../components/Button'
import { colors } from '../styles/tokens'

const INITIAL = {
  name: '',
  address: '',
  port: '',
  path: '',
  username: '',
  password: '',
  enabled: 1,
  control_protocol: '',
  control_address: '',
  control_port: '',
  control_username: '',
  control_password: '',
}

export default function CamCreatePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState(INITIAL)
  const [saving, setSaving] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        protocol: 'rtsp',
        name: form.name || null,
        address: form.address,
        port: Number(form.port),
        path: form.path || null,
        username: form.username,
        password: form.password,
        enabled: Number(form.enabled),
        control_protocol: form.control_protocol || null,
        control_address: form.control_protocol ? form.control_address : null,
        control_port: form.control_protocol && form.control_port !== '' ? Number(form.control_port) : null,
        control_username: form.control_protocol ? form.control_username : null,
        control_password: form.control_protocol ? form.control_password : null,
      }
      const { id } = await createCam(body)
      toast.success('Камера создана')
      navigate(`/cams/${id}`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 20, marginBottom: 24 }}>Добавить камеру</h1>
      <DashCard>
        <form onSubmit={handleSubmit}>
          <InputField
            label="Название"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Камера у входа"
          />
          <InputField
            label="Адрес потока (RTSP)"
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
          />
          <InputField
            label="Порт"
            type="number"
            value={form.port}
            onChange={(e) => update('port', e.target.value)}
          />
          <InputField
            label="Путь потока"
            value={form.path}
            onChange={(e) => update('path', e.target.value)}
            placeholder="/stream1"
          />
          <InputField label="Логин" value={form.username} onChange={(e) => update('username', e.target.value)} />
          <InputField
            label="Пароль"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
          />
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: colors.white[4], display: 'block', marginBottom: 8 }}>
              Включена
            </label>
            <Toggle
              checked={form.enabled === 1}
              onChange={(v) => update('enabled', v ? 1 : 0)}
            />
          </div>
          <SelectField
            label="PTZ протокол"
            value={form.control_protocol}
            onChange={(e) => update('control_protocol', e.target.value)}
            options={[
              { value: '', label: 'нет' },
              { value: 'onvif', label: 'onvif' },
            ]}
          />
          {form.control_protocol && (
            <>
              <InputField
                label="ONVIF адрес"
                value={form.control_address}
                onChange={(e) => update('control_address', e.target.value)}
              />
              <InputField
                label="ONVIF порт"
                type="number"
                value={form.control_port}
                onChange={(e) => update('control_port', e.target.value)}
              />
              <InputField
                label="ONVIF логин"
                value={form.control_username}
                onChange={(e) => update('control_username', e.target.value)}
              />
              <InputField
                label="ONVIF пароль"
                value={form.control_password}
                onChange={(e) => update('control_password', e.target.value)}
              />
            </>
          )}
          <Button variant="accent" type="submit" loading={saving} style={{ width: '100%' }}>
            Создать
          </Button>
        </form>
      </DashCard>
    </div>
  )
}

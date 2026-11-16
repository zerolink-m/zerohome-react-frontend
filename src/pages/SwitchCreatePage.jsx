import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createSwitch } from '../api/switches'
import { ApiError } from '../api/client'
import { CODES } from '../api/codes'
import { useToast } from '../context/ToastContext'
import DashCard from '../components/DashCard'
import InputField from '../components/InputField'
import SelectField from '../components/SelectField'
import Button from '../components/Button'
import Toggle from '../components/Toggle'
import ControlMetaTuyaLocal, { DEFAULT_TUYA_LOCAL } from '../components/switches/ControlMetaTuyaLocal'
import ControlMetaCustom, { DEFAULT_CUSTOM } from '../components/switches/ControlMetaCustom'
import { customFormToControlmeta } from '../utils/controlmeta'
import { colors } from '../styles/tokens'

// Tuya Cloud вручную не создаётся — такие выключатели заводятся только
// автоматически из соединений. Доступны только локальные протоколы.
const PROTO_OPTIONS = [
  { value: 'tuya_local', label: 'Tuya (локально)' },
  { value: 'custom', label: 'Custom HTTP' },
]

const DEFAULTS_BY_PROTO = {
  tuya_local: DEFAULT_TUYA_LOCAL,
  custom: DEFAULT_CUSTOM,
}

export default function SwitchCreatePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const initialProto = (() => {
    const p = searchParams.get('proto')
    return p && DEFAULTS_BY_PROTO[p] ? p : 'tuya_local'
  })()
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(1)
  const [notify, setNotify] = useState(0)
  const [control_protocol, setControlProtocol] = useState(initialProto)
  const [controlMetadata, setControlMetadata] = useState({ ...DEFAULTS_BY_PROTO[initialProto] })
  const [saving, setSaving] = useState(false)

  function handleProtoChange(proto) {
    setControlProtocol(proto)
    setControlMetadata({ ...DEFAULTS_BY_PROTO[proto] })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let meta
      if (control_protocol === 'custom') {
        meta = customFormToControlmeta(controlMetadata)
      } else {
        meta = controlMetadata
      }
      const body = {
        name: name || null,
        enabled: Number(enabled),
        notify: Number(notify),
        control_protocol,
        control_metadata: meta,
      }
      const { id } = await createSwitch(body)
      toast.success('Выключатель создан')
      navigate(`/switches/${id}`)
    } catch (e) {
      if (e instanceof ApiError && e.code === CODES.TUYA_LOCAL_NOT_ALLOWED) {
        toast.error('Локальное управление Tuya недоступно для вашего аккаунта')
      } else {
        toast.error(e.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, marginBottom: 24 }}>Добавить выключатель</h1>
      <DashCard>
        <form onSubmit={handleSubmit}>
          <InputField
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Свет в коридоре"
          />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 6 }}>
              Включён
            </label>
            <Toggle checked={enabled === 1} onChange={(v) => setEnabled(v ? 1 : 0)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 6 }}>
              Уведомления
            </label>
            <Toggle checked={notify === 1} onChange={(v) => setNotify(v ? 1 : 0)} />
          </div>
          <SelectField
            label="Протокол управления"
            value={control_protocol}
            onChange={(e) => handleProtoChange(e.target.value)}
            options={PROTO_OPTIONS}
          />

          {control_protocol === 'tuya_local' && (
            <ControlMetaTuyaLocal value={controlMetadata} onChange={setControlMetadata} />
          )}
          {control_protocol === 'custom' && <ControlMetaCustom value={controlMetadata} onChange={setControlMetadata} />}

          <Button variant="accent" type="submit" loading={saving} style={{ width: '100%' }}>
            Создать
          </Button>
        </form>
      </DashCard>
    </div>
  )
}

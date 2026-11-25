import { useState } from 'react'
import { useNavigate } from 'react-router'
import { createConnection, TUYA_ENDPOINTS } from '../api/connections'
import { describeApiError } from '../api/client'
import { useToast } from '../context/ToastContext'
import DashCard from '../components/DashCard'
import InputField from '../components/InputField'
import SelectField from '../components/SelectField'
import Button from '../components/Button'
import Toggle from '../components/Toggle'
import { colors } from '../styles/tokens'

const DEFAULT_ENDPOINT = 'eu'

export default function ConnectionCreatePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(1)
  const [accessId, setAccessId] = useState('')
  const [accessSecret, setAccessSecret] = useState('')
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT)
  const [tuyaUid, setTuyaUid] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        provider: 'tuya_cloud',
        name,
        enabled: Number(enabled),
        meta: {
          access_id: accessId,
          access_secret: accessSecret,
          endpoint,
          ...(tuyaUid ? { tuya_uid: tuyaUid } : {}),
        },
      }
      const conn = await createConnection(body)
      toast.success('Соединение создано')
      navigate(`/connections/${conn.id}`)
    } catch (err) {
      toast.error(describeApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, marginBottom: 24 }}>Добавить соединение</h1>
      <DashCard>
        <form onSubmit={handleSubmit}>
          <InputField
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Мой Tuya-аккаунт"
          />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 6 }}>
              Включено
            </label>
            <Toggle checked={enabled === 1} onChange={(v) => setEnabled(v ? 1 : 0)} />
          </div>

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
          />
          <SelectField
            label="Регион (endpoint)"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            options={TUYA_ENDPOINTS}
          />
          <InputField
            label="Tuya UID (опционально)"
            value={tuyaUid}
            onChange={(e) => setTuyaUid(e.target.value)}
          />
          <div style={{ fontSize: 11, color: colors.white[3], marginTop: -12, marginBottom: 16 }}>
            Без tuya_uid синхронизация не сможет работать.
          </div>

          <Button variant="accent" type="submit" loading={saving} style={{ width: '100%' }}>
            Создать
          </Button>
        </form>
      </DashCard>
    </div>
  )
}

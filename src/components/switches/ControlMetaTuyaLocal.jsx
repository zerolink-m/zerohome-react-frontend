import InputField from '../InputField'

export const DEFAULT_TUYA_LOCAL = { device_id: '', ip: '', local_key: '', version: '3.3' }

export default function ControlMetaTuyaLocal({ value, onChange, disabled }) {
  function update(field, val) {
    onChange({ ...value, [field]: val })
  }

  return (
    <>
      <InputField
        label="Device ID"
        value={value.device_id}
        onChange={(e) => update('device_id', e.target.value)}
        disabled={disabled}
      />
      <InputField
        label="IP-адрес"
        value={value.ip}
        onChange={(e) => update('ip', e.target.value)}
        disabled={disabled}
      />
      <InputField
        label="Local key"
        value={value.local_key}
        onChange={(e) => update('local_key', e.target.value)}
        disabled={disabled}
      />
      <InputField
        label="Версия протокола"
        value={value.version}
        onChange={(e) => update('version', e.target.value)}
        placeholder="3.3"
        disabled={disabled}
      />
    </>
  )
}

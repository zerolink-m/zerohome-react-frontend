import InputField from '../InputField'
import SelectField from '../SelectField'
import { TUYA_ENDPOINTS } from '../../api/connections'

export const DEFAULT_TUYA_CLOUD = {
  access_id: '',
  access_secret: '',
  endpoint: 'eu',
  device_id: '',
  dp_codes: null,
  dp_code: null,
  region: '',
}

export default function ControlMetaTuyaCloud({ value, onChange, disabled }) {
  function update(field, val) {
    onChange({ ...value, [field]: val })
  }

  return (
    <>
      <InputField
        label="Access ID"
        value={value.access_id}
        onChange={(e) => update('access_id', e.target.value)}
        disabled={disabled}
      />
      <InputField
        label="Access secret"
        type="password"
        value={value.access_secret}
        onChange={(e) => update('access_secret', e.target.value)}
        disabled={disabled}
      />
      <SelectField
        label="Endpoint (регион)"
        value={value.endpoint || 'eu'}
        onChange={(e) => update('endpoint', e.target.value)}
        options={TUYA_ENDPOINTS}
        disabled={disabled}
      />
      <InputField
        label="Device ID"
        value={value.device_id}
        onChange={(e) => update('device_id', e.target.value)}
        disabled={disabled}
      />
      <InputField
        label="DP code (одиночный, опционально)"
        value={value.dp_code || ''}
        onChange={(e) => update('dp_code', e.target.value || null)}
        placeholder="switch_led"
        disabled={disabled}
      />
      <InputField
        label="DP codes (через запятую, опционально)"
        value={Array.isArray(value.dp_codes) ? value.dp_codes.join(', ') : ''}
        onChange={(e) =>
          update('dp_codes', e.target.value ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : null)
        }
        placeholder="switch_led, bright_value"
        disabled={disabled}
      />
      <InputField
        label="Регион (опционально)"
        value={value.region || ''}
        onChange={(e) => update('region', e.target.value || null)}
        placeholder="eu"
        disabled={disabled}
      />
    </>
  )
}

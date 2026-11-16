import InputField from '../InputField'
import SelectField from '../SelectField'
import Button from '../Button'
import Toggle from '../Toggle'
import Divider from '../Divider'
import { colors } from '../../styles/tokens'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export const DEFAULT_ACTION = {
  request: { url: '', method: 'POST', headers: [], body: '' },
  response: null,
}

export const DEFAULT_RESPONSE = { path: '', mapText: '{\n  "true": 1,\n  "false": 0\n}' }

// value: { request: { url, method, headers: [{key,value}], body }, response: { path, mapText } | null }
export default function CustomActionEditor({ label, value, onChange }) {
  const request = value.request

  function updateRequest(field, val) {
    onChange({ ...value, request: { ...request, [field]: val } })
  }

  function updateHeader(idx, field, val) {
    const headers = request.headers.map((h, i) => (i === idx ? { ...h, [field]: val } : h))
    updateRequest('headers', headers)
  }

  function addHeader() {
    updateRequest('headers', [...request.headers, { key: '', value: '' }])
  }

  function removeHeader(idx) {
    updateRequest('headers', request.headers.filter((_, i) => i !== idx))
  }

  function toggleResponse(enabled) {
    onChange({ ...value, response: enabled ? { ...DEFAULT_RESPONSE } : null })
  }

  function updateResponse(field, val) {
    onChange({ ...value, response: { ...value.response, [field]: val } })
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 11,
          color: colors.white[3],
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <InputField
        label="URL"
        value={request.url}
        onChange={(e) => updateRequest('url', e.target.value)}
        placeholder="https://example.com/api/switch"
      />
      <SelectField
        label="Метод"
        value={request.method}
        onChange={(e) => updateRequest('method', e.target.value)}
        options={METHODS.map((m) => ({ value: m, label: m }))}
      />

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 6 }}>Заголовки</label>
        {request.headers.map((h, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <input
                value={h.key}
                onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                placeholder="Имя заголовка"
                style={{
                  width: '100%',
                  background: 'var(--w05)',
                  border: '1px solid var(--w10)',
                  borderRadius: 10,
                  color: 'var(--text)',
                  fontSize: 12,
                  padding: '8px 10px',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <input
                value={h.value}
                onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                placeholder="Значение"
                style={{
                  width: '100%',
                  background: 'var(--w05)',
                  border: '1px solid var(--w10)',
                  borderRadius: 10,
                  color: 'var(--text)',
                  fontSize: 12,
                  padding: '8px 10px',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
            <Button small onClick={() => removeHeader(idx)}>
              ×
            </Button>
          </div>
        ))}
        <Button small onClick={addHeader}>
          + заголовок
        </Button>
      </div>

      {request.method !== 'GET' && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 6 }}>
            Тело запроса
          </label>
          <textarea
            value={request.body}
            onChange={(e) => updateRequest('body', e.target.value)}
            rows={3}
            style={{
              width: '100%',
              background: 'var(--w05)',
              border: '1px solid var(--w10)',
              borderRadius: 10,
              color: 'var(--text)',
              fontSize: 12,
              padding: '10px',
              fontFamily: "'JetBrains Mono', monospace",
              resize: 'vertical',
            }}
          />
        </div>
      )}

      <Divider />

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 6 }}>
          Проверять ответ устройства
        </label>
        <Toggle checked={!!value.response} onChange={toggleResponse} />
      </div>

      {value.response && (
        <>
          <InputField
            label="Путь до значения в ответе"
            value={value.response.path}
            onChange={(e) => updateResponse('path', e.target.value)}
            placeholder="json://body/result/status"
          />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 6 }}>
              Карта значений → состояние (JSON, строка → 0|1)
            </label>
            <textarea
              value={value.response.mapText}
              onChange={(e) => updateResponse('mapText', e.target.value)}
              rows={5}
              style={{
                width: '100%',
                background: 'var(--w05)',
                border: '1px solid var(--w10)',
                borderRadius: 10,
                color: 'var(--text)',
                fontSize: 12,
                padding: '10px',
                fontFamily: "'JetBrains Mono', monospace",
                resize: 'vertical',
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}

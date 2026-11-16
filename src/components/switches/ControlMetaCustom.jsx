import CustomActionEditor, { DEFAULT_ACTION } from './CustomActionEditor'
import Toggle from '../Toggle'
import Divider from '../Divider'
import { colors } from '../../styles/tokens'

export const DEFAULT_CUSTOM = {
  on: { request: { url: '', method: 'POST', headers: [], body: '' }, response: null },
  off: { request: { url: '', method: 'POST', headers: [], body: '' }, response: null },
  sync: null,
}

// value: { on: Action, off: Action, sync: Action|null }
export default function ControlMetaCustom({ value, onChange, disabled }) {
  function toggleSync(enabled) {
    onChange({ ...value, sync: enabled ? { ...DEFAULT_ACTION } : null })
  }

  const inner = (
    <div>
      <CustomActionEditor label="Действие: включить" value={value.on} onChange={(v) => onChange({ ...value, on: v })} />
      <Divider />
      <CustomActionEditor
        label="Действие: выключить"
        value={value.off}
        onChange={(v) => onChange({ ...value, off: v })}
      />
      <Divider />
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: colors.white[4], marginBottom: 6 }}>
          Синхронизация состояния с устройством
        </label>
        <Toggle checked={!!value.sync} onChange={toggleSync} disabled={disabled} />
      </div>
      {value.sync && (
        <CustomActionEditor
          label="Действие: синхронизация"
          value={value.sync}
          onChange={(v) => onChange({ ...value, sync: v })}
        />
      )}
    </div>
  )

  if (disabled) {
    return (
      <div
        style={{ opacity: 0.6, pointerEvents: 'none', userSelect: 'text' }}
        aria-disabled="true"
      >
        {inner}
      </div>
    )
  }
  return inner
}

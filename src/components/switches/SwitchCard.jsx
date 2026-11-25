import { useState } from 'react'
import { Link } from 'react-router'
import DashCard from '../DashCard'
import { setSwitchState } from '../../api/switches'
import { ApiError } from '../../api/client'
import { CODES } from '../../api/codes'
import { useToast } from '../../context/ToastContext'
import { colors } from '../../styles/tokens'
import { getState } from '../../api/authStore'
import { sanitizeSnapshot } from '../../api/snapshots'

const PROTO_LABELS = {
  tuya_local: 'Tuya (локально)',
  tuya_cloud: 'Tuya (облако)',
  custom: 'Custom HTTP',
}

// Плоская модель выключателей: каждая запись самостоятельна.
//  - «Мастер» многоканального устройства = запись с controlmeta.dp_codes (массив);
//    управляет всеми каналами разом через свой POST /{id}/state.
//  - «Канал» = запись с controlmeta.dp_code (строка); свой независимый state.
// Группировки/детей больше нет — всё показываем плоско, у каждой карточки
// одна компактная кнопка вкл/выкл со своим именем.

// Подпись под названием: протокол + (для мастера) число каналов / (для канала) его dp_code.
function metaLine(sw) {
  const proto = PROTO_LABELS[sw.control_protocol] || sw.control_protocol
  const cm = sw.control_metadata
  if (cm && Array.isArray(cm.dp_codes) && cm.dp_codes.length > 0) {
    return `${proto} · каналов: ${cm.dp_codes.length}`
  }
  if (cm && cm.dp_code) {
    return `${proto} · канал ${cm.dp_code}`
  }
  return proto
}

// Компактная кнопка-переключатель с надписью.
function ToggleButton({ state, label, onToggle, sending, large }) {
  const [hover, setHover] = useState(false)
  const isOn = state === 1
  const scheme = isOn ? colors.statuses.green : colors.statuses.default
  return (
    <button
      type="button"
      className="card-action"
      role="switch"
      aria-checked={isOn}
      aria-label={label}
      disabled={sending}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        minHeight: large ? 92 : 52,
        background: scheme.bg,
        border: `1px solid ${scheme.border}`,
        color: scheme.text,
        borderRadius: 12,
        cursor: sending ? 'default' : 'pointer',
        opacity: sending ? 0.55 : 1,
        transition: '0.2s ease',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: large ? 17 : 14,
        letterSpacing: '0.04em',
        fontWeight: 600,
        transform: hover && !sending ? 'translateY(-1px)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: large ? '18px 22px' : '10px 14px',
        textAlign: 'left',
      }}
    >
      <span style={{ wordBreak: 'break-word', overflow: 'hidden' }}>{label}</span>
      <span style={{ flexShrink: 0, fontSize: large ? 14 : 12, opacity: 0.85 }}>
        {sending ? '...' : isOn ? 'вкл' : 'выкл'}
      </span>
    </button>
  )
}

export default function SwitchCard({ switchItem }) {
  const toast = useToast()
  const [hover, setHover] = useState(false)
  const [state, setState] = useState(switchItem.state ? 1 : 0)
  const [sending, setSending] = useState(false)

  async function toggle() {
    if (sending) return
    const cur = state
    const next = cur ? 0 : 1
    setSending(true)
    setState(next) // оптимистично
    try {
      const data = await setSwitchState(switchItem.id, next)
      setState(data.state ? 1 : 0)
    } catch (e) {
      setState(cur) // откат
      if (e instanceof ApiError && e.code === CODES.SERVER_ERROR) {
        toast.error('Устройство не отвечает')
      } else {
        toast.error(e.message)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <DashCard
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minWidth: 0,
        cursor: 'pointer',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: '0.25s ease',
      }}
    >
      <Link className="card-open-link" to={`/switches/${switchItem.id}`} state={{ preview: sanitizeSnapshot(switchItem), uid: getState().uid }} aria-label={`Открыть выключатель: ${switchItem.name || switchItem.id}`} />
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background:
            state === 1 || switchItem.enabled ? 'rgba(0,220,130,0.9)' : 'rgba(255,255,255,0.25)',
          boxShadow: state === 1 || switchItem.enabled ? '0 0 8px rgba(0,220,130,0.6)' : 'none',
        }}
      />
      <div style={{ fontSize: 15, marginBottom: 8, wordBreak: 'break-word', overflowWrap: 'anywhere', paddingRight: 20 }}>
        {switchItem.name || `Выключатель #${switchItem.id}`}
      </div>
      <div style={{ fontSize: 11, color: colors.white[2], marginBottom: 12, overflowWrap: 'anywhere' }}>
        id: {switchItem.id} · {metaLine(switchItem)}
      </div>

      <ToggleButton
        state={state}
        label={switchItem.name || `#${switchItem.id}`}
        onToggle={toggle}
        sending={sending}
        large={!Array.isArray(switchItem.control_metadata?.dp_codes) || switchItem.control_metadata.dp_codes.length <= 1}
      />
    </DashCard>
  )
}
